import { COMPLIANCE_RULES } from '../data/complianceRules';
import type {
  ComplianceRule,
  Framework,
  NormalizedConfig,
  PolicyRule,
  RuleResult } from
'../types/nexus';

function getField(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const allow = (rules: PolicyRule[]) => rules.filter((r) => r.action === 'ALLOW' && r.enabled);

type CustomCheck = (cfg: NormalizedConfig) => {pass: boolean;expected: string;actual: string;detail: string;};

const CUSTOM_CHECKS: Record<string, CustomCheck> = {
  'NET-003': (cfg) => {
    const v = cfg.management.sshVersion;
    const pass = !cfg.management.ssh || v === '2' || v === 'v2';
    return {
      pass,
      expected: 'ssh version = 2',
      actual: `ssh version = ${v}`,
      detail: pass ? 'SSHv2 enforced.' : 'SSH protocol version is not pinned to version 2.'
    };
  },
  'NET-006': (cfg) => {
    const t = cfg.management.idleTimeoutMinutes;
    const pass = t > 0 && t <= 15;
    return {
      pass,
      expected: 'idle timeout <= 15 min',
      actual: t ? `${t} min` : 'not configured',
      detail: pass ? 'Idle timeout within policy.' : 'Administrative sessions stay open too long.'
    };
  },
  'NET-007': (cfg) => {
    const exposed = cfg.interfaces.filter(
      (i) =>
      i.zone === 'Internet' &&
      i.allowedManagement.some((s) => ['ssh', 'http', 'https', 'telnet'].includes(s))
    );
    return {
      pass: exposed.length === 0,
      expected: 'no management services on Internet interfaces',
      actual: exposed.length ?
      exposed.map((i) => `${i.name}: ${i.allowedManagement.join(', ')}`).join(' | ') :
      'none',
      detail: exposed.length ?
      'Internet-facing interfaces accept administrative connections.' :
      'Management plane is not published to the Internet.'
    };
  },
  'NET-011': (cfg) => {
    const pass = !cfg.snmp.enabled || cfg.snmp.version === '3';
    return {
      pass,
      expected: 'snmp.version = 3',
      actual: cfg.snmp.enabled ? `v${cfg.snmp.version}` : 'snmp disabled',
      detail: pass ? 'SNMP monitoring uses v3.' : 'Legacy SNMP version accepted.'
    };
  },
  'NET-014': (cfg) => {
    const rules = cfg.firewallRules.filter((r) => r.enabled);
    const last = rules[rules.length - 1];
    const pass =
    !!last && last.action === 'DENY' && last.srcZone === 'any' && last.dstZone === 'any';
    return {
      pass,
      expected: 'final rule = DENY any → any',
      actual: last ? `${last.action} ${last.srcZone} → ${last.dstZone} (${last.name})` : 'no rules',
      detail: pass ? 'Explicit terminating deny present.' : 'Policy set has no explicit deny-all terminator.'
    };
  },
  'NET-015': (cfg) => {
    const broad = allow(cfg.firewallRules).filter(
      (r) => r.srcZone === 'any' && r.dstZone === 'any' && r.protocol === 'any'
    );
    return {
      pass: broad.length === 0,
      expected: 'no any → any allow rules',
      actual: broad.length ? broad.map((r) => r.name).join(', ') : 'none',
      detail: broad.length ?
      `${broad.length} unrestricted permit rule(s) bypass segmentation.` :
      'No unrestricted permit rules.'
    };
  },
  'NET-016': (cfg) => {
    const bad = allow(cfg.firewallRules).filter(
      (r) =>
      (r.srcZone === 'Internet' || r.srcZone === 'any') &&
      r.dstZone === 'Database' && (
      r.ports === 'any' || r.ports === '3306')
    );
    return {
      pass: bad.length === 0,
      expected: 'no Internet → Database permit',
      actual: bad.length ? bad.map((r) => `${r.name} (${r.protocol}/${r.ports})`).join(', ') : 'none',
      detail: bad.length ?
      'Untrusted networks are permitted into the database tier.' :
      'Database tier is closed to untrusted sources.'
    };
  },
  'NET-017': (cfg) => {
    const bad = allow(cfg.firewallRules).filter((r) => r.srcZone === 'DMZ' && r.dstZone === 'Database');
    return {
      pass: bad.length === 0,
      expected: 'no DMZ → Database permit',
      actual: bad.length ? bad.map((r) => r.name).join(', ') : 'none',
      detail: bad.length ? 'DMZ can bypass the application tier.' : 'DMZ has no direct data-tier path.'
    };
  },
  'NET-018': (cfg) => {
    const insecure = allow(cfg.firewallRules).filter((r) => ['23', '21', '80'].includes(r.ports));
    return {
      pass: insecure.length === 0,
      expected: 'no permit for telnet/ftp/http',
      actual: insecure.length ? insecure.map((r) => `${r.name} (${r.ports})`).join(', ') : 'none',
      detail: insecure.length ? 'Cleartext protocols permitted across zones.' : 'No cleartext protocol permits.'
    };
  },
  'NET-019': (cfg) => {
    const permits = allow(cfg.firewallRules);
    const unlogged = permits.filter((r) => !r.log);
    return {
      pass: permits.length === 0 || unlogged.length === 0,
      expected: 'logging enabled on all permit rules',
      actual: unlogged.length ? `${unlogged.length} of ${permits.length} unlogged` : 'all logged',
      detail: unlogged.length ? 'Permitted flows are not being recorded.' : 'All permits are logged.'
    };
  },
  'NET-020': (cfg) => {
    const weak = cfg.vpnConnections.filter((v) => !/aes256|aes-256/i.test(v.encryption));
    return {
      pass: weak.length === 0,
      expected: 'AES-256 class proposals',
      actual: cfg.vpnConnections.length ?
      cfg.vpnConnections.map((v) => `${v.name}: ${v.encryption}`).join(' | ') :
      'no tunnels',
      detail: weak.length ? 'One or more tunnels use unverified or weak proposals.' : 'Tunnel encryption acceptable.'
    };
  },
  'NET-021': (cfg) => {
    const bad = allow(cfg.firewallRules).filter(
      (r) => r.srcZone === 'Vendor' && (r.protocol === 'any' || r.ports === 'any' || r.dstZone !== 'Management')
    );
    return {
      pass: bad.length === 0,
      expected: 'vendor access scoped to jump host + named services',
      actual: bad.length ? bad.map((r) => `${r.name} → ${r.dstZone} ${r.protocol}/${r.ports}`).join(', ') : 'none',
      detail: bad.length ?
      'Third-party tunnel has broader access than least privilege allows.' :
      'Vendor access is least privilege.'
    };
  },
  'NET-023': (cfg) => {
    const count = cfg.aaa.localUsers.length;
    return {
      pass: count <= 2,
      expected: '<= 2 local privileged accounts',
      actual: `${count} local account(s)`,
      detail: count > 2 ? 'Too many local accounts on the device.' : 'Local account count within policy.'
    };
  },
  'NET-024': (cfg) => {
    const bad = cfg.natRules.filter((r) => r.type === 'destination' && (r.ports === 'any' || !r.ports));
    return {
      pass: bad.length === 0,
      expected: 'destination NAT scoped to specific ports',
      actual: bad.length ? bad.map((r) => r.name).join(', ') : 'none',
      detail: bad.length ? 'NAT publishes internal hosts without port scoping.' : 'NAT entries are port scoped.'
    };
  }
};

function evaluateRule(rule: ComplianceRule, cfg: NormalizedConfig) {
  const custom = CUSTOM_CHECKS[rule.id];
  if (rule.operator === 'custom' && custom) return custom(cfg);
  if (!rule.field) {
    return { pass: true, expected: 'n/a', actual: 'n/a', detail: 'No evaluator defined.' };
  }
  const actual = getField(cfg, rule.field);
  switch (rule.operator) {
    case 'equals':
      return {
        pass: actual === rule.expected,
        expected: `${rule.field} = ${String(rule.expected)}`,
        actual: `${rule.field} = ${String(actual)}`,
        detail: actual === rule.expected ? 'Value matches the required baseline.' : rule.description
      };
    case 'notEquals':
      return {
        pass: actual !== rule.expected,
        expected: `${rule.field} != ${String(rule.expected)}`,
        actual: `${rule.field} = ${String(actual)}`,
        detail: rule.description
      };
    case 'nonEmpty':{
        const arr = Array.isArray(actual) ? actual : [];
        return {
          pass: arr.length > 0,
          expected: `${rule.field} not empty`,
          actual: arr.length ? arr.join(', ') : 'empty',
          detail: arr.length ? 'Configured.' : rule.description
        };
      }
    default:
      return { pass: true, expected: 'n/a', actual: String(actual), detail: 'No evaluator defined.' };
  }
}

export function evaluateCompliance(
configs: {deviceId: string;normalized: NormalizedConfig;}[],
rules: ComplianceRule[] = COMPLIANCE_RULES)
: RuleResult[] {
  const results: RuleResult[] = [];
  configs.forEach(({ deviceId, normalized }) => {
    rules.forEach((rule) => {
      const outcome = evaluateRule(rule, normalized);
      results.push({
        ruleId: rule.id,
        deviceId,
        deviceName: normalized.device,
        vendor: normalized.vendor,
        status: outcome.pass ? 'PASS' : 'FAIL',
        expected: outcome.expected,
        actual: outcome.actual,
        detail: outcome.detail
      });
    });
  });
  return results;
}

export function complianceScoreFor(results: RuleResult[]): number {
  if (!results.length) return 0;
  const weights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const total = results.reduce((sum, r) => {
    const rule = COMPLIANCE_RULES.find((x) => x.id === r.ruleId);
    return sum + weights[rule?.severity ?? 'LOW'];
  }, 0);
  const earned = results.reduce((sum, r) => {
    const rule = COMPLIANCE_RULES.find((x) => x.id === r.ruleId);
    const w = weights[rule?.severity ?? 'LOW'];
    return sum + (r.status === 'PASS' ? w : 0);
  }, 0);
  return Math.round(earned / total * 100);
}

export function frameworkCoverage(results: RuleResult[]): {
  framework: Framework;
  total: number;
  passed: number;
  score: number;
}[] {
  const frameworks: Framework[] = ['CIS', 'NIST', 'ISO 27001', 'PCI DSS', 'Custom Policy'];
  return frameworks.map((framework) => {
    const relevant = results.filter((r) => {
      const rule = COMPLIANCE_RULES.find((x) => x.id === r.ruleId);
      return rule ? Boolean(rule.frameworks[framework]) : false;
    });
    const passed = relevant.filter((r) => r.status === 'PASS').length;
    return {
      framework,
      total: relevant.length,
      passed,
      score: relevant.length ? Math.round(passed / relevant.length * 100) : 0
    };
  });
}