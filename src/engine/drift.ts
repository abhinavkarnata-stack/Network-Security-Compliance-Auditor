import type { ConfigurationSnapshot, DriftEvent, PolicyRule, Severity } from '../types/nexus';
import { ruleText } from './parsers/shared';

interface Change {
  field: string;
  previous: string;
  current: string;
  severity: Severity;
}

function ruleKey(r: PolicyRule): string {
  return `${r.srcZone}|${r.dstZone}|${r.protocol}|${r.ports}`;
}

const SCALAR_FIELDS: {path: string;label: string;severity: Severity;risky: (v: unknown) => boolean;}[] = [
{ path: 'management.telnet', label: 'Management · Telnet', severity: 'HIGH', risky: (v) => v === true },
{ path: 'management.http', label: 'Management · HTTP', severity: 'HIGH', risky: (v) => v === true },
{ path: 'management.ssh', label: 'Management · SSH', severity: 'MEDIUM', risky: (v) => v === false },
{
  path: 'management.mgmtAccessRestricted',
  label: 'Management · source restriction',
  severity: 'CRITICAL',
  risky: (v) => v === false
},
{ path: 'logging.enabled', label: 'Logging · enabled', severity: 'HIGH', risky: (v) => v === false },
{ path: 'snmp.version', label: 'SNMP · version', severity: 'MEDIUM', risky: (v) => v !== '3' }];


function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

export function diffSnapshots(
previous: ConfigurationSnapshot,
current: ConfigurationSnapshot)
: Change[] {
  const changes: Change[] = [];

  SCALAR_FIELDS.forEach((f) => {
    const before = get(previous.normalized, f.path);
    const after = get(current.normalized, f.path);
    if (String(before) !== String(after)) {
      changes.push({
        field: f.label,
        previous: String(before),
        current: String(after),
        severity: f.risky(after) ? f.severity : 'LOW'
      });
    }
  });

  const prevRules = new Map(previous.normalized.firewallRules.map((r) => [ruleKey(r), r]));
  const currRules = new Map(current.normalized.firewallRules.map((r) => [ruleKey(r), r]));

  currRules.forEach((rule, key) => {
    const before = prevRules.get(key);
    if (!before) {
      const critical =
      rule.action === 'ALLOW' && (rule.dstZone === 'Database' || rule.srcZone === 'Internet');
      changes.push({
        field: `Policy added · ${rule.name}`,
        previous: 'not present (implicit deny)',
        current: ruleText(rule),
        severity: critical ? 'CRITICAL' : rule.action === 'ALLOW' ? 'MEDIUM' : 'LOW'
      });
    } else if (before.action !== rule.action) {
      changes.push({
        field: `Policy changed · ${rule.name}`,
        previous: ruleText(before),
        current: ruleText(rule),
        severity: rule.action === 'ALLOW' ? 'CRITICAL' : 'MEDIUM'
      });
    }
  });

  prevRules.forEach((rule, key) => {
    if (!currRules.has(key)) {
      changes.push({
        field: `Policy removed · ${rule.name}`,
        previous: ruleText(rule),
        current: 'not present (implicit deny)',
        severity: rule.action === 'DENY' ? 'HIGH' : 'LOW'
      });
    }
  });

  return changes;
}

export function detectDrift(
snapshots: ConfigurationSnapshot[],
orgId: string,
intentLookup: (deviceName: string, change: Change) => string | undefined)
: DriftEvent[] {
  const byDevice = new Map<string, ConfigurationSnapshot[]>();
  snapshots.forEach((s) => {
    byDevice.set(s.deviceId, [...(byDevice.get(s.deviceId) ?? []), s]);
  });

  const events: DriftEvent[] = [];
  byDevice.forEach((list) => {
    const ordered = [...list].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      diffSnapshots(previous, current).forEach((change, idx) => {
        events.push({
          id: `drift-${current.id}-${idx}`,
          orgId,
          deviceId: current.deviceId,
          deviceName: current.deviceName,
          severity: change.severity,
          field: change.field,
          previous: change.previous,
          current: change.current,
          intent: intentLookup(current.deviceName, change),
          detectedAt: current.takenAt,
          fromSnapshot: previous.label,
          toSnapshot: current.label
        });
      });
    }
  });

  return events.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export type { Change as DriftChange };