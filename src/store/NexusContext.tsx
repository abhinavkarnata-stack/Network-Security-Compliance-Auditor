import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState } from
'react';
import { toast } from 'sonner';
import {
  ASSET_EDGES,
  DEMO_ASSETS,
  DEMO_DEVICES,
  DEMO_INTENTS,
  DEMO_VENDORS,
  DRIFT_INJECTION,
  TOPOLOGY_EDGES } from
'../data/demoEnvironment';
import { AI_MODEL, answerQuestion, explainFinding, generateRemediation, type AIContext } from '../engine/ai';
import { buildReachabilityContext, latestConfigs, runAudit, type AuditOutput } from '../engine/audit';
import { analyzeReachability } from '../engine/reachability';
import { redactSecrets } from '../engine/redact';
import { detectVendor, parseConfiguration } from '../engine/parsers';
import type {
  Configuration,
  Device,
  Environment,
  Finding,
  NetworkIntent,
  Organization,
  Protocol,
  ReachabilityResult,
  Report,
  Role,
  User,
  Vendor,
  Zone } from
'../types/nexus';
import {
  DEFAULT_ORG_ID,
  can,
  emptyDB,
  hashPassword,
  loadDB,
  resetDB,
  saveDB,
  uid,
  verifyPassword,
  type NexusDB } from
'./db';

interface UploadInput {
  raw: string;
  fileName: string;
  vendor?: Vendor;
  deviceId?: string;
  newDeviceName?: string;
  environment: Environment;
  deviceType?: Device['type'];
  ip?: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  role?: Role;
}

interface ScanSummary {
  before: number;
  after: number;
  devices: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  drift: number;
  thirdParty: number;
}

interface NexusValue {
  db: NexusDB;
  user: User | null;
  orgId: string;
  orgName: string;
  hasData: boolean;
  analysis: AuditOutput;
  findings: Finding[];
  aiModel: string;
  login: (email: string, password: string) => boolean;
  register: (input: RegisterInput) => boolean;
  demoLogin: () => void;
  logout: () => void;
  loadDemoEnvironment: () => void;
  resetEnvironment: () => void;
  addDevice: (input: {
    name: string;
    vendor: Vendor;
    type: Device['type'];
    ip: string;
    environment: Environment;
  }) => Device | null;
  uploadConfiguration: (input: UploadInput) => Configuration | null;
  runScan: (trigger: string) => ScanSummary | null;
  simulateDrift: () => boolean;
  revertDrift: () => void;
  addIntent: (intent: Omit<NetworkIntent, 'id' | 'orgId'>) => void;
  deleteIntent: (id: string) => void;
  checkReachability: (source: Zone, destination: Zone, protocol: Protocol, port: string) => ReachabilityResult;
  setFindingStatus: (id: string, status: Finding['status']) => void;
  requestExplanation: (findingId: string) => void;
  requestRemediation: (findingId: string) => void;
  askAI: (question: string) => {answer: string;citations: string[];};
  generateReport: (type: Report['type']) => Report | null;
  log: (action: string, target: string) => void;
  hasPermission: (permission: string) => boolean;
}

const NexusContext = createContext<NexusValue | null>(null);

export function NexusProvider({ children }: {children: React.ReactNode;}) {
  const [db, setDb] = useState<NexusDB>(() => loadDB());

  useEffect(() => {
    saveDB(db);
  }, [db]);

  const user = useMemo(
    () => db.session ? db.users.find((u) => u.id === db.session?.userId) ?? null : null,
    [db.session, db.users]
  );
  const orgId = user?.orgId ?? DEFAULT_ORG_ID;
  const orgName = db.organizations.find((o) => o.id === orgId)?.name ?? 'Organization';

  const log = useCallback(
    (action: string, target: string) => {
      setDb((prev) => ({
        ...prev,
        audit_logs: [
        {
          id: uid('log'),
          orgId,
          actor: prev.session ?
          prev.users.find((u) => u.id === prev.session?.userId)?.email ?? 'system' :
          'anonymous',
          action,
          target,
          at: new Date().toISOString()
        },
        ...prev.audit_logs].
        slice(0, 400)
      }));
    },
    [orgId]
  );

  const hasPermission = useCallback((permission: string) => can(user?.role as Role, permission), [user]);

  /* ------------------------------- analysis -------------------------------- */
  const analysis = useMemo<AuditOutput>(() => {
    const devices = db.devices.filter((d) => d.orgId === orgId);
    return runAudit({
      orgId,
      devices,
      configurations: db.configurations.filter((c) => c.orgId === orgId),
      snapshots: db.configuration_snapshots.filter((s) => s.orgId === orgId),
      intents: db.network_intents.filter((i) => i.orgId === orgId),
      assets: db.assets.filter((a) => a.orgId === orgId),
      vendors: db.vendors.filter((v) => v.orgId === orgId),
      assetEdges: db.dependencies.filter((d) => d.orgId === orgId),
      topologyEdges: db.topology_edges.filter((e) => e.orgId === orgId)
    });
  }, [db, orgId]);

  const findings = useMemo(
    () =>
    analysis.findings.map((f) => {
      const override = db.finding_overrides[f.id];
      if (!override) return f;
      return {
        ...f,
        status: override.status ?? f.status,
        aiExplanation: override.aiExplanation as Finding['aiExplanation'] ?? f.aiExplanation,
        remediation: override.remediation as Finding['remediation'] ?? f.remediation
      };
    }),
    [analysis.findings, db.finding_overrides]
  );

  const aiContext = useMemo<AIContext>(
    () => ({
      findings,
      risk: analysis.risk,
      vendorRisks: analysis.vendorRisks,
      intents: db.network_intents.filter((i) => i.orgId === orgId),
      driftSummary: analysis.driftEvents.map((d) => ({
        deviceName: d.deviceName,
        field: d.field,
        previous: d.previous,
        current: d.current
      })),
      deviceCount: db.devices.filter((d) => d.orgId === orgId).length,
      complianceScore: analysis.complianceScore
    }),
    [findings, analysis, db.network_intents, db.devices, orgId]
  );

  /* --------------------------------- auth ---------------------------------- */
  const login = useCallback(
    (email: string, password: string) => {
      const found = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!found || !verifyPassword(password, found.passwordDigest)) {
        toast.error('Invalid credentials');
        return false;
      }
      setDb((prev) => ({ ...prev, session: { userId: found.id } }));
      log('Login', found.email);
      toast.success(`Signed in as ${found.name}`);
      return true;
    },
    [db.users, log]
  );

  /**
   * Creates a new tenant: one organization plus its first Administrator. The new
   * organization starts empty, so the account lands on the first-run state
   * rather than inheriting another tenant's data.
   */
  const register = useCallback<NexusValue['register']>(
    (input) => {
      const email = input.email.trim().toLowerCase();
      const name = input.name.trim();
      if (!name) {
        toast.error('Enter your full name');
        return false;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
        toast.error('Enter a valid work email address');
        return false;
      }
      if (input.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return false;
      }
      if (db.users.some((u) => u.email.toLowerCase() === email)) {
        toast.error('An account with that email already exists');
        return false;
      }

      const organization: Organization = {
        id: uid('org'),
        name: input.organizationName.trim() || `${name.split(' ')[0]} Security`
      };
      const created: User = {
        id: uid('user'),
        orgId: organization.id,
        email,
        name,
        role: input.role ?? 'Administrator',
        passwordDigest: hashPassword(input.password),
        createdAt: new Date().toISOString()
      };

      setDb((prev) => ({
        ...prev,
        organizations: [...prev.organizations, organization],
        users: [...prev.users, created],
        session: { userId: created.id },
        audit_logs: [
        {
          id: uid('log'),
          orgId: organization.id,
          actor: email,
          action: 'Account created',
          target: `${organization.name} · ${created.role}`,
          at: new Date().toISOString()
        },
        ...prev.audit_logs].
        slice(0, 400)
      }));

      toast.success(`${organization.name} created — signed in as ${created.role}`);
      return true;
    },
    [db.users]
  );

  const demoLogin = useCallback(() => {
    login('demo@nexus.io', 'nexus-demo');
  }, [login]);

  const logout = useCallback(() => {
    log('Logout', user?.email ?? 'unknown');
    setDb((prev) => ({ ...prev, session: null }));
  }, [log, user]);

  /* ---------------------------- demo environment --------------------------- */
  const loadDemoEnvironment = useCallback(() => {
    const now = Date.now();
    const devices: Device[] = [];
    const configurations: Configuration[] = [];
    const snapshots: NexusDB['configuration_snapshots'] = [];

    DEMO_DEVICES.forEach((seed, index) => {
      const deviceId = `dev-${seed.name.toLowerCase()}`;
      const normalized = parseConfiguration(seed.raw, seed.vendor, seed.name);
      devices.push({
        id: deviceId,
        orgId,
        name: seed.name,
        vendor: seed.vendor,
        type: seed.type,
        ip: seed.ip,
        environment: seed.environment,
        compliance: 0,
        risk: 'LOW',
        lastScan: null,
        status: 'Unscanned'
      });
      const configId = `cfg-${deviceId}`;
      configurations.push({
        id: configId,
        orgId,
        deviceId,
        deviceName: seed.name,
        vendor: seed.vendor,
        environment: seed.environment,
        fileName: `${seed.name.toLowerCase()}.cfg`,
        raw: seed.raw,
        normalized,
        uploadedAt: new Date(now - (index + 1) * 3600_000).toISOString(),
        version: 1
      });
      snapshots.push(
        {
          id: `snap-${deviceId}-1`,
          orgId,
          deviceId,
          deviceName: seed.name,
          configurationId: configId,
          label: 'Snapshot 1 · reviewed baseline',
          normalized,
          takenAt: new Date(now - 7 * 86_400_000).toISOString()
        },
        {
          id: `snap-${deviceId}-2`,
          orgId,
          deviceId,
          deviceName: seed.name,
          configurationId: configId,
          label: 'Snapshot 2 · nightly collection',
          normalized,
          takenAt: new Date(now - 86_400_000).toISOString()
        }
      );
    });

    const history = [88, 86, 90, 89, 91, 92].map((score, i) => ({
      id: `risk-hist-${i}`,
      orgId,
      overall: score,
      compliance: 100 - score + 6,
      exposure: 30 - i,
      thirdParty: 52 + i,
      drift: 8,
      calculatedAt: new Date(now - (6 - i) * 7 * 86_400_000).toISOString()
    }));

    setDb((prev) => ({
      ...prev,
      devices: [...prev.devices.filter((d) => d.orgId !== orgId), ...devices],
      configurations: [...prev.configurations.filter((c) => c.orgId !== orgId), ...configurations],
      configuration_snapshots: [
      ...prev.configuration_snapshots.filter((s) => s.orgId !== orgId),
      ...snapshots],

      network_intents: [
      ...prev.network_intents.filter((i) => i.orgId !== orgId),
      ...DEMO_INTENTS.map((i) => ({ ...i, id: uid('int'), orgId }))],

      assets: [
      ...prev.assets.filter((a) => a.orgId !== orgId),
      ...DEMO_ASSETS.map((a) => ({ ...a, id: uid('ast'), orgId }))],

      vendors: [
      ...prev.vendors.filter((v) => v.orgId !== orgId),
      ...DEMO_VENDORS.map((v) => ({ ...v, id: uid('ven'), orgId }))],

      dependencies: [
      ...prev.dependencies.filter((d) => d.orgId !== orgId),
      ...ASSET_EDGES.map((e) => ({ ...e, orgId }))],

      topology_edges: [
      ...prev.topology_edges.filter((e) => e.orgId !== orgId),
      ...TOPOLOGY_EDGES.map((e) => ({ ...e, orgId }))],

      risk_scores: [...prev.risk_scores.filter((r) => r.orgId !== orgId), ...history],
      finding_overrides: {},
      alerts: prev.alerts.filter((a) => a.orgId !== orgId)
    }));

    log('Demo environment loaded', `${DEMO_DEVICES.length} devices`);
    toast.success(`Demo environment loaded — ${DEMO_DEVICES.length} devices parsed`);
  }, [orgId, log]);

  const resetEnvironment = useCallback(() => {
    const fresh = resetDB();
    setDb({ ...fresh, session: db.session });
    toast.success('Environment cleared');
  }, [db.session]);

  /* ------------------------------- devices --------------------------------- */
  const addDevice = useCallback<NexusValue['addDevice']>(
    (input) => {
      if (!hasPermission('device:create')) {
        toast.error('Your role cannot add devices');
        return null;
      }
      const device: Device = {
        id: uid('dev'),
        orgId,
        name: input.name,
        vendor: input.vendor,
        type: input.type,
        ip: input.ip,
        environment: input.environment,
        compliance: 0,
        risk: 'LOW',
        lastScan: null,
        status: 'Unscanned'
      };
      setDb((prev) => ({ ...prev, devices: [...prev.devices, device] }));
      log('Device added', device.name);
      toast.success(`${device.name} added`);
      return device;
    },
    [hasPermission, orgId, log]
  );

  /* --------------------------- configuration upload ------------------------ */
  const uploadConfiguration = useCallback<NexusValue['uploadConfiguration']>(
    (input) => {
      if (!hasPermission('config:upload')) {
        toast.error('Your role cannot upload configurations');
        return null;
      }
      if (!input.raw.trim()) {
        toast.error('Configuration file is empty');
        return null;
      }
      if (input.raw.length > 400_000) {
        toast.error('Configuration exceeds the 400KB validation limit');
        return null;
      }
      const detection = detectVendor(input.raw);
      const vendor = input.vendor ?? detection.vendor;
      if (!vendor) {
        toast.error('Vendor could not be detected — select one explicitly');
        return null;
      }

      let deviceId = input.deviceId;
      let deviceName = db.devices.find((d) => d.id === deviceId)?.name;
      if (!deviceId) {
        const created = addDevice({
          name: input.newDeviceName?.trim() || `${vendor}-Device-${db.devices.length + 1}`,
          vendor,
          type: input.deviceType ?? (vendor === 'Cisco' || vendor === 'Juniper' ? 'Router' : 'Firewall'),
          ip: input.ip || '0.0.0.0',
          environment: input.environment
        });
        if (!created) return null;
        deviceId = created.id;
        deviceName = created.name;
      }

      const normalized = parseConfiguration(input.raw, vendor, deviceName);
      const version =
      db.configurations.filter((c) => c.deviceId === deviceId).length + 1;
      const configuration: Configuration = {
        id: uid('cfg'),
        orgId,
        deviceId: deviceId!,
        deviceName: deviceName ?? normalized.device,
        vendor,
        environment: input.environment,
        fileName: input.fileName,
        raw: input.raw,
        normalized,
        uploadedAt: new Date().toISOString(),
        version
      };

      setDb((prev) => ({
        ...prev,
        configurations: [...prev.configurations, configuration],
        configuration_snapshots: [
        ...prev.configuration_snapshots,
        {
          id: uid('snap'),
          orgId,
          deviceId: configuration.deviceId,
          deviceName: configuration.deviceName,
          configurationId: configuration.id,
          label: `Snapshot ${version} · uploaded ${input.fileName}`,
          normalized,
          takenAt: configuration.uploadedAt
        }]

      }));

      log('Configuration uploaded', `${configuration.deviceName} · ${input.fileName}`);
      return configuration;
    },
    [hasPermission, db.devices, db.configurations, orgId, addDevice, log]
  );

  /* --------------------------------- scan ---------------------------------- */
  const runScan = useCallback<NexusValue['runScan']>(
    (trigger) => {
      if (!hasPermission('audit:run')) {
        toast.error('Your role cannot run audits');
        return null;
      }
      const before =
      db.risk_scores.filter((r) => r.orgId === orgId).slice(-1)[0]?.overall ?? analysis.risk.overall;
      const summary: ScanSummary = {
        before,
        after: analysis.risk.overall,
        devices: db.devices.filter((d) => d.orgId === orgId).length,
        critical: findings.filter((f) => f.severity === 'CRITICAL').length,
        high: findings.filter((f) => f.severity === 'HIGH').length,
        medium: findings.filter((f) => f.severity === 'MEDIUM').length,
        low: findings.filter((f) => f.severity === 'LOW').length,
        drift: analysis.driftEvents.length,
        thirdParty: analysis.vendorRisks.filter((v) => v.concentrationRisk !== 'LOW').length
      };

      setDb((prev) => ({
        ...prev,
        devices: prev.devices.map((d) => {
          const update = analysis.deviceUpdates.find((u) => u.id === d.id);
          return update ?? d;
        }),
        risk_scores: [
        ...prev.risk_scores,
        { ...analysis.risk, orgId, id: uid('risk') }].
        slice(-40),
        audit_runs: [
        {
          id: uid('run'),
          orgId,
          startedAt: new Date().toISOString(),
          devices: summary.devices,
          critical: summary.critical,
          high: summary.high,
          medium: summary.medium,
          low: summary.low,
          driftEvents: summary.drift,
          thirdPartyRisks: summary.thirdParty,
          scoreBefore: summary.before,
          scoreAfter: summary.after,
          trigger
        },
        ...prev.audit_runs].
        slice(0, 50)
      }));

      log('Audit executed', trigger);
      return summary;
    },
    [hasPermission, db.risk_scores, db.devices, orgId, analysis, findings, log]
  );

  /* ------------------------------ drift demo ------------------------------- */
  const simulateDrift = useCallback(() => {
    if (!hasPermission('drift:simulate')) {
      toast.error('Your role cannot simulate drift');
      return false;
    }
    const target = latestConfigs(db.configurations.filter((c) => c.orgId === orgId)).find(
      (c) => c.deviceName === DRIFT_INJECTION.deviceName
    );
    if (!target) {
      toast.error(`${DRIFT_INJECTION.deviceName} configuration not found — load the demo environment first`);
      return false;
    }
    if (target.raw.includes('TEMP-Emergency-DB-Access')) {
      toast.info('Drift already present on Fortinet-FW-01');
      return false;
    }

    const raw = target.raw.replace(
      DRIFT_INJECTION.anchor,
      `${DRIFT_INJECTION.anchor}${DRIFT_INJECTION.editBlock}`
    );
    const normalized = parseConfiguration(raw, target.vendor, target.deviceName);
    const version = target.version + 1;
    const configId = uid('cfg');
    const at = new Date().toISOString();

    setDb((prev) => ({
      ...prev,
      configurations: [
      ...prev.configurations,
      { ...target, id: configId, raw, normalized, version, uploadedAt: at, fileName: `${target.deviceName.toLowerCase()}-change-${version}.conf` }],

      configuration_snapshots: [
      ...prev.configuration_snapshots,
      {
        id: uid('snap'),
        orgId,
        deviceId: target.deviceId,
        deviceName: target.deviceName,
        configurationId: configId,
        label: `Snapshot ${version} · unreviewed change`,
        normalized,
        takenAt: at
      }],

      alerts: [
      {
        id: uid('alert'),
        orgId,
        severity: 'CRITICAL',
        message: `Critical security drift on ${target.deviceName}: Internet → Database TCP/3306 changed DENY → ALLOW`,
        at
      },
      ...prev.alerts].
      slice(0, 50)
    }));

    log('Drift simulated', `${target.deviceName} · Internet → Database TCP/3306 DENY → ALLOW`);
    toast.error('Critical security drift detected on Fortinet-FW-01');
    return true;
  }, [hasPermission, db.configurations, orgId, log]);

  const revertDrift = useCallback(() => {
    setDb((prev) => ({
      ...prev,
      configurations: prev.configurations.filter((c) => !c.raw.includes('TEMP-Emergency-DB-Access')),
      configuration_snapshots: prev.configuration_snapshots.filter(
        (s) => !s.normalized.firewallRules.some((r) => r.name === 'TEMP-Emergency-DB-Access')
      ),
      alerts: prev.alerts.filter((a) => !a.message.includes('Internet → Database'))
    }));
    log('Drift reverted', DRIFT_INJECTION.deviceName);
    toast.success('Emergency policy removed — baseline restored');
  }, [log]);

  /* -------------------------------- intents -------------------------------- */
  const addIntent = useCallback<NexusValue['addIntent']>(
    (intent) => {
      if (!hasPermission('intent:write')) {
        toast.error('Your role cannot modify network intent');
        return;
      }
      setDb((prev) => ({
        ...prev,
        network_intents: [...prev.network_intents, { ...intent, id: uid('int'), orgId }]
      }));
      log('Intent modified', `${intent.source} → ${intent.destination} ${intent.action}`);
      toast.success('Intent rule stored');
    },
    [hasPermission, orgId, log]
  );

  const deleteIntent = useCallback(
    (id: string) => {
      if (!hasPermission('intent:write')) {
        toast.error('Your role cannot modify network intent');
        return;
      }
      setDb((prev) => ({ ...prev, network_intents: prev.network_intents.filter((i) => i.id !== id) }));
      log('Intent modified', `deleted ${id}`);
    },
    [hasPermission, log]
  );

  /* ----------------------------- reachability ------------------------------ */
  const checkReachability = useCallback<NexusValue['checkReachability']>(
    (source, destination, protocol, port) => {
      const ctx = buildReachabilityContext(
        db.configurations.filter((c) => c.orgId === orgId),
        db.topology_edges.filter((e) => e.orgId === orgId)
      );
      return analyzeReachability(source, destination, protocol, port, ctx);
    },
    [db.configurations, db.topology_edges, orgId]
  );

  /* -------------------------------- findings ------------------------------- */
  const setFindingStatus = useCallback((id: string, status: Finding['status']) => {
    setDb((prev) => ({
      ...prev,
      finding_overrides: {
        ...prev.finding_overrides,
        [id]: { ...prev.finding_overrides[id], status }
      }
    }));
  }, []);

  const requestExplanation = useCallback(
    (findingId: string) => {
      const finding = findings.find((f) => f.id === findingId);
      if (!finding) return;
      const explanation = explainFinding(finding, aiContext);
      setDb((prev) => ({
        ...prev,
        finding_overrides: {
          ...prev.finding_overrides,
          [findingId]: { ...prev.finding_overrides[findingId], aiExplanation: explanation }
        }
      }));
      log('AI analysis requested', finding.title);
    },
    [findings, aiContext, log]
  );

  const requestRemediation = useCallback(
    (findingId: string) => {
      const finding = findings.find((f) => f.id === findingId);
      if (!finding) return;
      const remediation = generateRemediation(finding);
      setDb((prev) => ({
        ...prev,
        finding_overrides: {
          ...prev.finding_overrides,
          [findingId]: { ...prev.finding_overrides[findingId], remediation }
        }
      }));
      log('Remediation generated', finding.title);
    },
    [findings, log]
  );

  const askAI = useCallback<NexusValue['askAI']>(
    (question) => {
      log('AI analysis requested', question.slice(0, 80));
      return answerQuestion(question, aiContext);
    },
    [aiContext, log]
  );

  /* -------------------------------- reports -------------------------------- */
  const generateReport = useCallback<NexusValue['generateReport']>(
    (type) => {
      if (!hasPermission('report:generate')) {
        toast.error('Your role cannot generate reports');
        return null;
      }
      const open = findings.filter((f) => f.status !== 'Resolved');
      const payload: Record<string, unknown> = {
        organization: orgName,
        generatedBy: user?.email ?? 'unknown',
        securityScore: analysis.risk.overall,
        complianceScore: analysis.complianceScore,
        frameworkCoverage: analysis.frameworkCoverage,
        devices: analysis.deviceUpdates.map((d) => ({
          name: d.name,
          vendor: d.vendor,
          environment: d.environment,
          compliance: d.compliance,
          risk: d.risk
        })),
        criticalFindings: open.
        filter((f) => f.severity === 'CRITICAL').
        map((f) => ({ title: f.title, device: f.deviceName, intent: f.intent, actual: f.actual })),
        reachabilityViolations: analysis.intentEvaluations.
        filter((e) => !e.compliant).
        map((e) => ({
          flow: `${e.intent.source} → ${e.intent.destination} ${e.intent.protocol}/${e.intent.port}`,
          expected: e.expected,
          actual: e.actual,
          path: e.pathText
        })),
        thirdParty: analysis.vendorRisks.map((v) => ({
          vendor: v.vendor.name,
          connections: v.connections,
          criticalAssets: v.criticalAssets,
          concentrationRisk: v.concentrationRisk,
          cascadePath: v.cascadePath
        })),
        drift: analysis.driftEvents.map((d) => ({
          device: d.deviceName,
          field: d.field,
          previous: d.previous,
          current: d.current,
          severity: d.severity
        })),
        recommendations: open.
        slice(0, 10).
        map((f) => `${f.severity}: ${f.title} — ${f.remediation?.recommendation ?? 'Generate remediation for vendor-specific steps.'}`),
        aiModel: AI_MODEL
      };

      const report: Report = {
        id: uid('rep'),
        orgId,
        type,
        title: `${type} Report · ${orgName}`,
        generatedAt: new Date().toISOString(),
        generatedBy: user?.email ?? 'unknown',
        payload: JSON.parse(redactSecrets(JSON.stringify(payload)).text)
      };

      setDb((prev) => ({ ...prev, reports: [report, ...prev.reports].slice(0, 40) }));
      log('Report generated', `${type}`);
      toast.success(`${type} report generated`);
      return report;
    },
    [hasPermission, findings, orgName, user, analysis, orgId, log]
  );

  const value: NexusValue = {
    db,
    user,
    orgId,
    orgName,
    hasData: db.devices.some((d) => d.orgId === orgId),
    analysis,
    findings,
    aiModel: AI_MODEL,
    login,
    register,
    demoLogin,
    logout,
    loadDemoEnvironment,
    resetEnvironment,
    addDevice,
    uploadConfiguration,
    runScan,
    simulateDrift,
    revertDrift,
    addIntent,
    deleteIntent,
    checkReachability,
    setFindingStatus,
    requestExplanation,
    requestRemediation,
    askAI,
    generateReport,
    log,
    hasPermission
  };

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus(): NexusValue {
  const ctx = useContext(NexusContext);
  if (!ctx) throw new Error('useNexus must be used inside NexusProvider');
  return ctx;
}

export { emptyDB };