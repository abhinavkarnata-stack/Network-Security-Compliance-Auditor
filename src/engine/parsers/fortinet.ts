import type { NormalizedConfig, PolicyRule } from '../../types/nexus';
import {
  countSecrets,
  emptyNormalized,
  finalizeZones,
  serviceToProtoPort,
  zoneForToken } from
'./shared';

interface Block {
  name: string;
  sets: Record<string, string>;
}

export function parseFortinetBlocks(raw: string): {
  sections: Record<string, Block[]>;
  globals: Record<string, Record<string, string>>;
} {
  const sections: Record<string, Block[]> = {};
  const globals: Record<string, Record<string, string>> = {};
  const stack: string[] = [];
  let cur: Block | null = null;

  for (const rawLine of raw.split('\n')) {
    const t = rawLine.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('config ')) {
      stack.push(t.slice(7).replace(/"/g, '').trim());
      const key = stack.join(' ');
      sections[key] = sections[key] ?? [];
      globals[key] = globals[key] ?? {};
      continue;
    }
    if (t === 'end') {
      stack.pop();
      cur = null;
      continue;
    }
    if (t.startsWith('edit ')) {
      const key = stack.join(' ');
      cur = { name: t.slice(5).replace(/"/g, '').trim(), sets: {} };
      sections[key] = sections[key] ?? [];
      sections[key].push(cur);
      continue;
    }
    if (t === 'next') {
      cur = null;
      continue;
    }
    if (t.startsWith('set ')) {
      const rest = t.slice(4);
      const sp = rest.indexOf(' ');
      const key = sp < 0 ? rest : rest.slice(0, sp);
      const value = sp < 0 ? 'true' : rest.slice(sp + 1).replace(/"/g, '').trim();
      if (cur) cur.sets[key] = value;else
      {
        const sKey = stack.join(' ');
        globals[sKey] = globals[sKey] ?? {};
        globals[sKey][key] = value;
      }
    }
  }
  return { sections, globals };
}

export function parseFortinet(raw: string, fallbackName = 'Fortinet-Device'): NormalizedConfig {
  const cfg = emptyNormalized('Fortinet', fallbackName);
  const { sections, globals } = parseFortinetBlocks(raw);

  const sysGlobal = globals['system global'] ?? {};
  if (sysGlobal.hostname) {
    cfg.hostname = sysGlobal.hostname;
    cfg.device = sysGlobal.hostname;
  }
  cfg.management.telnet = sysGlobal['admin-telnet'] === 'enable';
  cfg.management.https = true;
  cfg.management.http = sysGlobal['admin-http'] === 'enable';
  cfg.management.idleTimeoutMinutes = Math.round(
    parseInt(sysGlobal.admintimeout ?? '0', 10) / 60
  );

  const admins = sections['system admin'] ?? [];
  admins.forEach((a) => {
    cfg.aaa.localUsers.push({ name: a.name, privilege: a.sets.accprofile ?? 'unknown' });
    const trust = a.sets.trusthost1;
    if (trust && trust !== '0.0.0.0 0.0.0.0') cfg.management.mgmtAccessRestricted = true;
  });

  (sections['system interface'] ?? []).forEach((i) => {
    const ip = (i.sets.ip ?? '').split(/\s+/)[0];
    const allow = (i.sets.allowaccess ?? '').split(/\s+/).filter(Boolean);
    cfg.interfaces.push({
      name: i.name,
      description: i.sets.description ?? i.sets.alias ?? '',
      ipAddress: ip,
      zone: (i.sets.zone ? zoneForToken(i.sets.zone) : zoneForToken(ip)) as never,
      allowedManagement: allow,
      enabled: (i.sets.status ?? 'up') === 'up'
    });
    if (allow.includes('ssh')) cfg.management.ssh = true;
    if (allow.includes('http')) cfg.management.http = true;
    if (allow.includes('telnet')) cfg.management.telnet = true;
  });

  (sections['router static'] ?? []).forEach((r) => {
    const dst = (r.sets.dst ?? '0.0.0.0 0.0.0.0').split(/\s+/);
    cfg.routes.push({
      destination: dst[0] === '0.0.0.0' ? '0.0.0.0/0' : `${dst[0]}/24`,
      nextHop: r.sets.gateway ?? '-',
      type: 'static'
    });
  });

  (sections['firewall policy'] ?? []).forEach((p, index) => {
    const svc = serviceToProtoPort(p.sets.service ?? 'ALL');
    const srcZone = zoneForToken(p.sets.srcintf ?? 'any');
    const dstZone = zoneForToken(p.sets.dstintf ?? 'any');
    const rule: PolicyRule = {
      id: `fw-${p.name}`,
      name: p.sets.name ?? `policy ${p.name}`,
      srcZone,
      dstZone:
      dstZone === 'any' && p.sets.dstaddr ? zoneForToken(p.sets.dstaddr) : dstZone,
      source: p.sets.srcaddr ?? 'all',
      destination: p.sets.dstaddr ?? 'all',
      protocol: svc.protocol,
      ports: svc.ports,
      action: (p.sets.action ?? 'deny') === 'accept' ? 'ALLOW' : 'DENY',
      log: (p.sets.logtraffic ?? 'disable') !== 'disable',
      enabled: (p.sets.status ?? 'enable') !== 'disable',
      seq: index + 1,
      raw: `edit ${p.name} / ${p.sets.name ?? ''} — ${p.sets.srcintf} → ${p.sets.dstintf} ${
      p.sets.service ?? 'ALL'} ${
      p.sets.action ?? 'deny'}`,
      kind: 'firewall'
    };
    cfg.firewallRules.push(rule);
  });

  (sections['firewall vip'] ?? []).forEach((v) => {
    cfg.natRules.push({
      id: `nat-${v.name}`,
      name: v.name,
      type: 'destination',
      original: `${v.sets.extip}:${v.sets.extport}`,
      translated: `${v.sets.mappedip}:${v.sets.mappedport}`,
      ports: v.sets.extport ?? 'any',
      raw: `VIP ${v.name} ${v.sets.extip}:${v.sets.extport} → ${v.sets.mappedip}:${v.sets.mappedport}`
    });
  });

  (sections['vpn ipsec phase1-interface'] ?? []).forEach((v) => {
    cfg.vpnConnections.push({
      id: `vpn-${v.name}`,
      name: v.name,
      peer: v.sets['remote-gw'] ?? 'unknown',
      type: 'site-to-site',
      localZone: 'Internet',
      remoteParty: v.name.replace(/-VPN$/i, ''),
      encryption: v.sets.proposal ?? 'unspecified'
    });
  });

  const logSetting = globals['log setting'] ?? {};
  cfg.logging.enabled = logSetting.status === 'enable';
  if (logSetting['syslog-server']) cfg.logging.syslogServers.push(logSetting['syslog-server']);

  const snmpInfo = globals['system snmp sysinfo'] ?? {};
  const communities = sections['system snmp community'] ?? [];
  cfg.snmp.enabled = snmpInfo.status === 'enable';
  if (communities.length) {
    cfg.snmp.version = communities.some((c) => c.sets['query-v1-status'] === 'enable') ?
    '1/2c' :
    '2c';
    cfg.snmp.insecureCommunity = communities.some((c) =>
    ['public', 'private'].includes((c.sets.name ?? '').toLowerCase())
    );
  } else if (cfg.snmp.enabled) {
    cfg.snmp.version = '3';
  }

  const ntp = globals['system ntp'] ?? {};
  cfg.ntp.enabled = ntp.ntpsync === 'enable';
  if (ntp.server) cfg.ntp.servers.push(ntp.server);
  const dns = globals['system dns'] ?? {};
  if (dns.primary) cfg.dns.servers.push(dns.primary);

  cfg.secretsRedacted = countSecrets(raw);
  return finalizeZones(cfg);
}