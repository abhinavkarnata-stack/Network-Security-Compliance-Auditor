import { COMPLIANCE_RULES, RULES_BY_ID } from '../data/complianceRules';
import type {
  Asset,
  Configuration,
  ConfigurationSnapshot,
  DependencyEdge,
  Device,
  DriftEvent,
  Finding,
  Framework,
  NetworkIntent,
  NormalizedConfig,
  RiskScores,
  RuleResult,
  Severity,
  ThirdPartyVendor,
  TopologyEdgeDef } from
'../types/nexus';
import { complianceScoreFor, evaluateCompliance, frameworkCoverage } from './compliance';
import { analyzeVendorRisk, type VendorRisk } from './dependencies';
import { detectDrift } from './drift';
import { analyzeSegmentation, evaluateIntents, type IntentEvaluation, type SegmentationCell } from './intent';
import { calculateRisk } from './risk';
import type { ReachabilityContext } from './reachability';

export interface AuditInput {
  orgId: string;
  devices: Device[];
  configurations: Configuration[];
  snapshots: ConfigurationSnapshot[];
  intents: NetworkIntent[];
  assets: Asset[];
  vendors: ThirdPartyVendor[];
  assetEdges: DependencyEdge[];
  topologyEdges: TopologyEdgeDef[];
}

export interface AuditOutput {
  ruleResults: RuleResult[];
  findings: Finding[];
  driftEvents: DriftEvent[];
  vendorRisks: VendorRisk[];
  intentEvaluations: IntentEvaluation[];
  segmentation: SegmentationCell[];
  risk: RiskScores;
  complianceScore: number;
  frameworkCoverage: {framework: Framework;total: number;passed: number;score: number;}[];
  deviceUpdates: Device[];
}

export function latestConfigs(configurations: Configuration[]): Configuration[] {
  const byDevice = new Map<string, Configuration>();
  configurations.forEach((c) => {
    const existing = byDevice.get(c.deviceId);
    if (!existing || c.version > existing.version) byDevice.set(c.deviceId, c);
  });
  return Array.from(byDevice.values());
}

export function buildReachabilityContext(
configurations: Configuration[],
topologyEdges: TopologyEdgeDef[])
: ReachabilityContext {
  const configsByDevice: Record<string, NormalizedConfig> = {};
  latestConfigs(configurations).forEach((c) => {
    configsByDevice[c.deviceName] = c.normalized;
  });
  return { edges: topologyEdges, configsByDevice };
}

const SEVERITY_FROM_PRIORITY: Record<NetworkIntent['priority'], Severity> = {
  Critical: 'CRITICAL',
  High: 'HIGH',
  Medium: 'MEDIUM',
  Low: 'LOW'
};

function frameworksOf(ruleId: string): Framework[] {
  const rule = RULES_BY_ID[ruleId];
  return rule ? Object.keys(rule.frameworks) as Framework[] : [];
}

function assetsInZone(assets: Asset[], zone: string): string[] {
  return assets.filter((a) => a.zone === zone).map((a) => a.name);
}

export function runAudit(input: AuditInput): AuditOutput {
  const configs = latestConfigs(input.configurations);
  const ctx = buildReachabilityContext(input.configurations, input.topologyEdges);
  const now = new Date().toISOString();

  /* ---------------------------- compliance engine --------------------------- */
  const ruleResults = evaluateCompliance(
    configs.map((c) => ({ deviceId: c.deviceId, normalized: c.normalized }))
  );
  const complianceScore = complianceScoreFor(ruleResults);
  const coverage = frameworkCoverage(ruleResults);

  const findings: Finding[] = [];

  const failuresByRule = new Map<string, RuleResult[]>();
  ruleResults.
  filter((r) => r.status === 'FAIL').
  forEach((r) => failuresByRule.set(r.ruleId, [...(failuresByRule.get(r.ruleId) ?? []), r]));

  failuresByRule.forEach((fails, ruleId) => {
    const rule = RULES_BY_ID[ruleId];
    if (!rule) return;
    const primary = fails[0];
    findings.push({
      id: `f-cmp-${ruleId}`,
      orgId: input.orgId,
      title: `${rule.name} — ${fails.length} device${fails.length > 1 ? 's' : ''} non-compliant`,
      severity: rule.severity,
      category: 'Compliance',
      deviceId: fails.length === 1 ? primary.deviceId : undefined,
      deviceName: fails.length === 1 ? primary.deviceName : undefined,
      vendor: fails.length === 1 ? primary.vendor : undefined,
      environment: input.devices.find((d) => d.id === primary.deviceId)?.environment,
      status: 'Open',
      ruleId,
      frameworks: frameworksOf(ruleId),
      summary: `${rule.description} ${primary.detail}`,
      evidence: [
      { label: 'Rule', value: `${rule.id} · ${rule.name}` },
      { label: 'Expected', value: primary.expected },
      ...fails.slice(0, 6).map((f) => ({ label: f.deviceName, value: f.actual }))],

      intent: `Baseline: ${primary.expected}`,
      actual: primary.actual,
      affectedAssets: [],
      riskWeight: fails.length,
      createdAt: now
    });
  });

  /* ------------------------- intent / segmentation -------------------------- */
  const intentEvaluations = evaluateIntents(input.intents, ctx);
  const segmentation = analyzeSegmentation(input.intents, ctx);

  intentEvaluations.
  filter((e) => !e.compliant).
  forEach((e) => {
    const overPermissive = e.expected === 'DENY' && e.actual === 'ALLOW';
    const severity = overPermissive ? SEVERITY_FROM_PRIORITY[e.intent.priority] : 'MEDIUM';
    const affected = assetsInZone(input.assets, e.intent.destination);
    const enforcingDevice = e.path?.find((h) => h.device)?.device;
    const device = input.devices.find((d) => d.name === enforcingDevice);

    findings.push({
      id: `f-int-${e.intent.id}`,
      orgId: input.orgId,
      title: overPermissive ?
      `${e.intent.source} → ${e.intent.destination} reachable on ${e.intent.protocol.toUpperCase()}/${e.intent.port}` :
      `Intended ${e.intent.source} → ${e.intent.destination} flow is not permitted`,
      severity,
      category: 'Intent Violation',
      deviceId: device?.id,
      deviceName: device?.name,
      vendor: device?.vendor,
      environment: e.intent.environment,
      status: 'Open',
      frameworks: overPermissive ? ['CIS', 'NIST', 'PCI DSS'] : ['Custom Policy'],
      summary: `${e.intent.description} Declared intent is ${e.expected}; effective network behaviour is ${e.actual}.`,
      evidence: [
      { label: 'Flow', value: `${e.intent.source} → ${e.intent.destination}` },
      { label: 'Port', value: `${e.intent.protocol.toUpperCase()}/${e.intent.port}` },
      { label: 'Intent', value: e.expected },
      { label: 'Actual', value: e.actual },
      { label: 'Path', value: e.pathText },
      ...(e.blockedBy ? [{ label: 'Blocked by', value: e.blockedBy }] : [])],

      intent: `${e.expected} (${e.intent.priority} priority)`,
      actual: e.actual,
      path: e.path,
      affectedAssets: affected,
      riskWeight: overPermissive ? 3 : 1,
      createdAt: now
    });

    if (overPermissive) {
      findings.push({
        id: `f-seg-${e.intent.id}`,
        orgId: input.orgId,
        title: `Segmentation violation · ${e.intent.source} zone can cross into ${e.intent.destination} zone`,
        severity: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        category: 'Segmentation',
        deviceId: device?.id,
        deviceName: device?.name,
        vendor: device?.vendor,
        environment: e.intent.environment,
        status: 'Open',
        frameworks: ['CIS', 'PCI DSS', 'ISO 27001'],
        summary: `Zone boundary ${e.intent.source} → ${e.intent.destination} is being crossed on ${e.intent.protocol.toUpperCase()}/${e.intent.port}, collapsing two trust levels.`,
        evidence: [
        { label: 'Zone boundary', value: `${e.intent.source} → ${e.intent.destination}` },
        { label: 'Expected', value: 'DENY (segmented)' },
        { label: 'Actual', value: 'ALLOW (crossed)' },
        { label: 'Path', value: e.pathText }],

        intent: 'DENY (segmented)',
        actual: 'ALLOW (crossed)',
        path: e.path,
        affectedAssets: affected,
        riskWeight: 2,
        createdAt: now
      });

      const sensitive = input.assets.filter(
        (a) => a.zone === e.intent.destination && a.criticality !== 'Standard'
      );
      if (sensitive.length) {
        findings.push({
          id: `f-rch-${e.intent.id}`,
          orgId: input.orgId,
          title: `Reachability exposure · ${sensitive.
          map((s) => s.name).
          join(', ')} reachable from ${e.intent.source}`,
          severity: 'CRITICAL',
          category: 'Reachability',
          deviceId: device?.id,
          deviceName: device?.name,
          vendor: device?.vendor,
          environment: e.intent.environment,
          status: 'Open',
          frameworks: ['CIS', 'NIST', 'PCI DSS'],
          summary: `Reachability analysis completes a path from ${e.intent.source} to ${sensitive.
          map((s) => s.name).
          join(', ')} on ${e.intent.protocol.toUpperCase()}/${e.intent.port}.`,
          evidence: [
          { label: 'Source', value: e.intent.source },
          { label: 'Destination', value: sensitive.map((s) => `${s.name} (${s.ip})`).join(', ') },
          { label: 'Port', value: `${e.intent.protocol.toUpperCase()}/${e.intent.port}` },
          { label: 'Result', value: 'REACHABLE' },
          { label: 'Path', value: e.pathText }],

          intent: 'BLOCKED',
          actual: 'REACHABLE',
          path: e.path,
          affectedAssets: sensitive.map((s) => s.name),
          riskWeight: 3,
          createdAt: now
        });
      }
    }
  });

  /* ------------------------------ third-party ------------------------------- */
  const vendorRisks = analyzeVendorRisk(input.vendors, input.assets, input.assetEdges);
  vendorRisks.
  filter((v) => v.concentrationRisk === 'CRITICAL' || v.concentrationRisk === 'HIGH').
  forEach((v) => {
    findings.push({
      id: `f-tp-${v.vendor.id}`,
      orgId: input.orgId,
      title: `Excessive third-party access · ${v.vendor.name}`,
      severity: v.concentrationRisk === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      category: 'Third-Party',
      environment: 'Production',
      status: 'Open',
      frameworks: ['CIS', 'ISO 27001', 'Custom Policy'],
      summary: `${v.vendor.name} connects over ${v.vendor.connectionType} and reaches ${v.dependentSystems} systems including ${v.criticalAssets.length} critical assets. Concentration risk ${v.concentrationRisk}.`,
      evidence: [
      { label: 'Connection', value: `${v.vendor.connectionType} · ${v.vendor.service}` },
      { label: 'Connections', value: String(v.connections) },
      { label: 'Critical assets in reach', value: v.criticalAssets.join(', ') || 'none' },
      { label: 'Sensitive assets in reach', value: v.sensitiveAssets.join(', ') || 'none' },
      { label: 'Potential cascading impact', value: v.cascadePath.join(' → ') }],

      intent: 'Least-privilege vendor access (jump host, named services)',
      actual: `${v.connections} connection(s), ${v.criticalAssets.length} critical assets in reach`,
      affectedAssets: [...v.criticalAssets, ...v.sensitiveAssets],
      riskWeight: 2,
      createdAt: now
    });
  });

  /* --------------------------------- drift ---------------------------------- */
  const driftEvents = detectDrift(input.snapshots, input.orgId, (deviceName, change) => {
    const match = input.intents.find(
      (i) =>
      change.current.includes(i.port) &&
      change.current.includes(i.destination) &&
      change.current.includes(i.source)
    );
    return match ? `${match.action} ${match.source} → ${match.destination} ${match.protocol.toUpperCase()}/${match.port}` : undefined;
  });

  driftEvents.
  filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').
  forEach((d) => {
    const device = input.devices.find((x) => x.id === d.deviceId);
    findings.push({
      id: `f-drift-${d.id}`,
      orgId: input.orgId,
      title: `${d.severity === 'CRITICAL' ? 'Critical security drift' : 'Security drift'} · ${d.deviceName} — ${d.field}`,
      severity: d.severity,
      category: 'Drift',
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      vendor: device?.vendor,
      environment: device?.environment,
      status: 'Open',
      frameworks: ['CIS', 'NIST', 'ISO 27001'],
      summary: `Configuration changed outside the reviewed baseline between ${d.fromSnapshot} and ${d.toSnapshot}.`,
      evidence: [
      { label: 'Device', value: d.deviceName },
      { label: 'Changed', value: d.field },
      { label: 'Previous', value: d.previous },
      { label: 'Current', value: d.current },
      ...(d.intent ? [{ label: 'Intent', value: d.intent }] : [])],

      intent: d.intent ?? 'Match reviewed baseline',
      actual: d.current,
      affectedAssets: [],
      riskWeight: 2,
      createdAt: d.detectedAt
    });
  });

  /* --------------------------------- risk ----------------------------------- */
  const violations = intentEvaluations.filter(
    (e) => e.expected === 'DENY' && e.actual === 'ALLOW'
  );
  const sensitiveExposures = violations.filter((v) =>
  input.assets.some((a) => a.zone === v.intent.destination && a.criticality === 'Critical')
  ).length;

  const risk = calculateRisk({
    findings,
    complianceScore,
    exposedFlows: violations.length,
    totalFlows: Math.max(1, input.intents.length),
    sensitiveAssetExposures: sensitiveExposures,
    vendorRisks,
    driftEvents
  });

  /* ---------------------------- device rollups ------------------------------ */
  const deviceUpdates = input.devices.map((device) => {
    const results = ruleResults.filter((r) => r.deviceId === device.id);
    if (!results.length) return device;
    const fails = results.filter((r) => r.status === 'FAIL');
    const severities = fails.
    map((f) => RULES_BY_ID[f.ruleId]?.severity).
    filter((s): s is Severity => !!s);
    const compliance = complianceScoreFor(results);
    const risky: Severity = severities.includes('CRITICAL') ?
    'CRITICAL' :
    severities.filter((s) => s === 'HIGH').length >= 2 ?
    'HIGH' :
    severities.includes('HIGH') ?
    'MEDIUM' :
    'LOW';
    return {
      ...device,
      compliance,
      risk: risky === 'CRITICAL' ? 'CRITICAL' : risky,
      lastScan: now,
      status:
      risky === 'CRITICAL' ? 'Critical' : risky === 'HIGH' ? 'Warning' : 'Healthy' as Device['status']
    } as Device;
  });

  return {
    ruleResults,
    findings: findings.sort(
      (a, b) =>
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.severity) -
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.severity)
    ),
    driftEvents,
    vendorRisks,
    intentEvaluations,
    segmentation,
    risk,
    complianceScore,
    frameworkCoverage: coverage,
    deviceUpdates
  };
}

export const ALL_RULES = COMPLIANCE_RULES;