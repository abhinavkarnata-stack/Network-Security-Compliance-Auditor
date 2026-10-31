import type {
  AIExplanation,
  Finding,
  NetworkIntent,
  Remediation,
  RiskScores,
  Vendor } from
'../types/nexus';
import type { VendorRisk } from './dependencies';
import { sanitizeForAI } from './redact';

export const AI_MODEL = 'nexus-analyst (local template engine)';
export const AI_LIVE = false; // No LLM API key is connected — template engine is used.

export interface AIContext {
  findings: Finding[];
  risk: RiskScores;
  vendorRisks: VendorRisk[];
  intents: NetworkIntent[];
  driftSummary: {deviceName: string;field: string;previous: string;current: string;}[];
  deviceCount: number;
  complianceScore: number;
}

/** Structured, secret-free payload actually handed to the AI layer. */
export function buildAIPayload(finding: Finding) {
  return sanitizeForAI({
    device: finding.deviceName ?? 'multiple devices',
    vendor: finding.vendor ?? 'multiple vendors',
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    intent: finding.intent,
    actual: finding.actual,
    frameworks: finding.frameworks,
    evidence: finding.evidence,
    path: finding.path?.map((h) => h.node),
    affectedAssets: finding.affectedAssets
  });
}

const IMPACT_BY_CATEGORY: Record<string, string> = {
  'Intent Violation':
  'A flow the organization explicitly declared as forbidden is currently permitted, so the control that was assumed to exist is not actually enforced anywhere in the path.',
  Reachability:
  'An untrusted or lower-trust network can complete a connection to a protected asset, removing the layered defence the segmentation model depends on.',
  Segmentation:
  'Zone boundaries are being crossed in a way the segmentation model forbids, which collapses two trust levels into one.',
  Drift:
  'The running configuration no longer matches the reviewed baseline, so a change was introduced outside the approved change process.',
  'Third-Party':
  'A third party holds broader network access than their service requires, extending the blast radius of any compromise on their side.',
  Compliance:
  'A required baseline control is missing, which weakens either the management plane, the audit trail, or the enforcement of least privilege.'
};

const REMEDIATION_TEMPLATES: Record<Vendor, (f: Finding) => {text: string;commands: string[];}> = {
  Fortinet: (f) => ({
    text: `On the FortiGate, remove or scope the offending policy, then re-verify with the policy lookup tool. Restrict TCP/${
    portOf(f) || '3306'} to authorized application server address groups and remove any public source.`,

    commands: [
    'config firewall policy',
    '    delete 0',
    '    edit 7',
    '        set name "App-to-Database"',
    '        set srcintf "Application"',
    '        set dstintf "Database"',
    '        set srcaddr "App-Servers"',
    '        set dstaddr "Prod-DB"',
    `        set service "${portOf(f) === '3306' ? 'MYSQL' : 'HTTPS'}"`,
    '        set action accept',
    '        set logtraffic all',
    '    next',
    'end']

  }),
  Cisco: (f) => ({
    text: `On the IOS device, replace the permissive ACL entry with a least-privilege entry scoped to the application subnet and re-apply the ACL to the interface. Confirm the ACL still terminates in an explicit deny with logging.`,
    commands: [
    'ip access-list extended APP-TO-DB',
    ' no permit ip any any',
    ` permit tcp 10.0.20.0 0.0.0.255 10.0.30.0 0.0.0.255 eq ${portOf(f) || '3306'}`,
    ' deny ip any any log',
    'exit']

  }),
  Juniper: () => ({
    text: 'On the SRX/JunOS device, scope the third-party policy to the jump host and named applications only, then commit with a confirmed rollback window.',
    commands: [
    'delete security policies from-zone Vendor to-zone Application policy vendor-app-any',
    'set security policies from-zone Vendor to-zone Management policy vendor-jump-ssh match destination-address Jump-Server application junos-ssh',
    'set security policies from-zone Vendor to-zone Management policy vendor-jump-ssh then permit log session-init session-close',
    'commit confirmed 5']

  }),
  'Palo Alto': (f) => ({
    text: `On PAN-OS, tighten the security rule so only the application tier address group can reach the database service, and keep the terminating deny with logging enabled.`,
    commands: [
    'set rulebase security rules Allow-App-to-DB from Application to Database source App-Servers destination Prod-DB service tcp-3306 action allow log-end yes',
    `delete rulebase security rules Allow-Any-to-DB`,
    'commit']

  })
};

function portOf(f: Finding): string {
  const evidence = f.evidence.find((e) => /port/i.test(e.label));
  if (evidence) return evidence.value.replace(/\D/g, '');
  const m = (f.title + (f.actual ?? '')).match(/\b(\d{2,5})\b/);
  return m ? m[1] : '';
}

export function explainFinding(finding: Finding, ctx: AIContext): AIExplanation {
  const payload = buildAIPayload(finding);
  const device = payload.device;
  const frameworks = finding.frameworks.length ? finding.frameworks.join(', ') : 'internal policy';
  const assets = finding.affectedAssets.length ?
  finding.affectedAssets.join(', ') :
  'no assets tagged';

  return {
    whatHappened: `${device} is currently in a state where ${lower(finding.title)}. ${
    finding.intent ?
    `The declared intent for this flow is ${finding.intent}, but the effective configuration results in ${finding.actual}.` :
    finding.evidence.map((e) => `${e.label}: ${e.value}`).slice(0, 3).join('; ') + '.'}`,

    whyItMatters:
    IMPACT_BY_CATEGORY[finding.category] ??
    'The effective configuration diverges from the approved security baseline.',
    potentialImpact: `Potential impact: an attacker or unauthorized user positioned at the source of this flow could interact with ${assets}. ${
    finding.path && finding.path.length ?
    `The analysed path is ${finding.path.map((h) => h.node).join(' → ')}, so every device on that path is currently permitting the flow.` :
    ''} This describes exposure, not a confirmed compromise.`,

    complianceImplications: `This finding maps to ${frameworks}. At the current posture the organization would not be able to evidence enforcement of these controls; overall compliance is ${ctx.complianceScore}% across ${ctx.deviceCount} devices.`,
    recommendation: `${
    finding.severity === 'CRITICAL' ? 'Treat as an emergency change. ' : ''}Remove or scope the permitting rule at the first enforcement point on the path, re-run the audit to confirm the flow returns to ${

    finding.intent?.includes('DENY') ? 'blocked' : 'the intended state'}, and record the change so the next drift comparison has a clean baseline.`,

    generatedAt: new Date().toISOString(),
    model: AI_MODEL
  };
}

export function generateRemediation(finding: Finding): Remediation {
  const vendor = (finding.vendor ?? 'Cisco') as Vendor;
  const template = REMEDIATION_TEMPLATES[vendor] ?? REMEDIATION_TEMPLATES.Cisco;
  const built = template(finding);
  return {
    id: `rem-${finding.id}`,
    vendor: finding.vendor ?? 'N/A',
    recommendation: built.text,
    commands: built.commands,
    generatedAt: new Date().toISOString()
  };
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export interface AIAnswer {
  answer: string;
  citations: string[];
}

export function answerQuestion(question: string, ctx: AIContext): AIAnswer {
  const q = question.toLowerCase();
  const critical = ctx.findings.filter((f) => f.severity === 'CRITICAL' && f.status !== 'Resolved');
  const high = ctx.findings.filter((f) => f.severity === 'HIGH' && f.status !== 'Resolved');

  if (/why.*critical|why is this/.test(q)) {
    const target = critical[0];
    if (!target) return { answer: 'There are currently no open critical findings in this organization.', citations: [] };
    return {
      answer: `“${target.title}” is critical because the declared intent is ${
      target.intent ?? 'a deny'} while the effective configuration produces ${

      target.actual ?? 'an allow'}. ${
      IMPACT_BY_CATEGORY[target.category]} Affected assets: ${target.affectedAssets.join(', ') || 'unmapped'}. Frameworks impacted: ${target.frameworks.join(', ')}.`,
      citations: [target.id]
    };
  }

  if (/vendor|third.?part/.test(q) && /reach|production|access/.test(q)) {
    const lines = ctx.vendorRisks.map(
      (v) =>
      `${v.vendor.name} (${v.vendor.connectionType}) reaches ${v.dependentSystems} systems, ${v.criticalAssets.length} critical (${v.criticalAssets.join(', ') || 'none'}); concentration risk ${v.concentrationRisk}.`
    );
    return {
      answer: `Third-party reach into production:\n\n${lines.join('\n')}\n\nThe dominant contributor is ${
      ctx.vendorRisks[0]?.vendor.name ?? 'n/a'}, whose cascading path is ${
      ctx.vendorRisks[0]?.cascadePath.join(' → ') ?? 'n/a'}.`,
      citations: ctx.vendorRisks.map((v) => v.vendor.name)
    };
  }

  if (/changed|drift|since.*audit/.test(q)) {
    if (!ctx.driftSummary.length)
    return { answer: 'No configuration drift has been detected between the stored snapshots.', citations: [] };
    return {
      answer: `Detected changes since the previous snapshot:\n\n${ctx.driftSummary.
      map((d) => `${d.deviceName} — ${d.field}: ${d.previous} → ${d.current}`).
      join('\n')}\n\nEach change was re-evaluated against intent, reachability and the compliance baseline.`,
      citations: ctx.driftSummary.map((d) => d.deviceName)
    };
  }

  if (/reach the database|who can reach|which systems/.test(q)) {
    const dbFindings = ctx.findings.filter((f) => /database/i.test(f.title));
    return {
      answer: `Based on the current reachability graph, the database tier is reachable from the application tier (intended) and from the management network for administration. ${
      dbFindings.length ?
      `The analysis also flags ${dbFindings.length} unintended path(s): ${dbFindings.
      map((f) => f.title).
      join('; ')}.` :
      'No unintended paths into the database tier are currently open.'}`,

      citations: dbFindings.map((f) => f.id)
    };
  }

  if (/highest.?risk|dependenc/.test(q)) {
    const top = ctx.vendorRisks[0];
    return {
      answer: top ?
      `Your highest-risk dependency is ${top.vendor.name}: ${top.connections} connection(s) via ${top.vendor.connectionType}, ${top.criticalAssets.length} critical assets in reach, concentration risk ${top.concentrationRisk}. Potential cascading impact path: ${top.cascadePath.join(' → ')}. ${
      top.singlePointOfFailure ? 'It is also a single point of failure for at least one critical asset.' : ''}` :

      'No third-party dependencies have been modelled yet.',
      citations: top ? [top.vendor.name] : []
    };
  }

  if (/remediat|how should i fix|fix/.test(q)) {
    const target = critical[0] ?? high[0];
    if (!target) return { answer: 'Nothing currently requires remediation.', citations: [] };
    const rem = generateRemediation(target);
    return {
      answer: `For “${target.title}” on ${target.deviceName ?? 'the affected devices'}:\n\n${rem.recommendation}\n\nSuggested configuration (review before applying to production):\n${rem.commands.join('\n')}`,
      citations: [target.id]
    };
  }

  if (/score|posture|summary|status/.test(q)) {
    return {
      answer: `Current posture: overall security score ${ctx.risk.overall}/100, compliance risk ${ctx.risk.compliance}/100, network exposure ${ctx.risk.exposure}/100, third-party risk ${ctx.risk.thirdParty}/100, drift risk ${ctx.risk.drift}/100. Open findings: ${critical.length} critical, ${high.length} high across ${ctx.deviceCount} devices.`,
      citations: []
    };
  }

  return {
    answer: `I analyse the structured audit output: ${ctx.findings.length} findings (${critical.length} critical), ${ctx.deviceCount} devices, ${ctx.intents.length} intent rules and ${ctx.vendorRisks.length} third-party dependencies. Ask me why a finding is critical, which vendors can reach production, what changed since the last audit, which systems can reach the database, your highest-risk dependencies, or how to remediate a specific finding.`,
    citations: []
  };
}