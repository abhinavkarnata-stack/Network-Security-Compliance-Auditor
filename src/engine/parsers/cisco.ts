import type { NormalizedConfig, PolicyRule, Protocol } from '../../types/nexus';
import { countSecrets, emptyNormalized, finalizeZones, zoneForToken } from './shared';

function onesIn(mask: string): number {
  return mask.
  split('.').
  map((o) => parseInt(o, 10) || 0).
  map((o) => o.toString(2).padStart(8, '0')).
  join('').
  split('').
  filter((b) => b === '1').length;
}

/** 255.255.255.0 → /24 */
function maskToPrefix(mask: string): string {
  return `/${onesIn(mask)}`;
}

/** 0.0.0.255 → /24 */
function wildcardToPrefix(wildcard: string): string {
  return `/${32 - onesIn(wildcard)}`;
}

/** Consumes a Cisco ACL address specification, returning [text, tokensUsed]. */
function readAddress(tokens: string[], i: number): [string, number] {
  const t = tokens[i];
  if (!t) return ['any', 1];
  if (t === 'any') return ['any', 1];
  if (t === 'host') return [tokens[i + 1] ?? 'any', 2];
  const mask = tokens[i + 1] ?? '0.0.0.0';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(mask)) {
    return [`${t}${wildcardToPrefix(mask)}`, 2];
  }
  return [t, 1];
}

export function parseCisco(raw: string, fallbackName = 'Cisco-Device'): NormalizedConfig {
  const cfg = emptyNormalized('Cisco', fallbackName);
  const lines = raw.split('\n');
  let currentIf: NormalizedConfig['interfaces'][number] | null = null;
  let currentAcl: string | null = null;
  let inVty = false;
  let seq = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, '');
    const t = line.trim();
    const indented = /^\s/.test(line);

    if (!indented) {
      currentIf = null;
      currentAcl = null;
      inVty = false;
    }

    const host = t.match(/^hostname\s+(\S+)/);
    if (host) {
      cfg.hostname = host[1];
      cfg.device = host[1];
      continue;
    }

    const ifm = t.match(/^interface\s+(\S+)/);
    if (ifm) {
      currentIf = {
        name: ifm[1],
        description: '',
        ipAddress: '',
        zone: 'unassigned',
        allowedManagement: [],
        enabled: true
      };
      cfg.interfaces.push(currentIf);
      continue;
    }

    if (currentIf) {
      const desc = t.match(/^description\s+(.+)/);
      if (desc) currentIf.description = desc[1];
      const ip = t.match(/^ip address\s+(\S+)\s+(\S+)/);
      if (ip) {
        currentIf.ipAddress = `${ip[1]}${maskToPrefix(ip[2])}`;
        if (currentIf.zone === 'unassigned') currentIf.zone = zoneForToken(ip[1]) as never;
      }
      const zm = t.match(/^zone-member security\s+(\S+)/);
      if (zm) currentIf.zone = zoneForToken(zm[1]) as never;
      if (t === 'shutdown') currentIf.enabled = false;
      continue;
    }

    const vlan = t.match(/^vlan\s+(\d+)/);
    if (vlan) {
      cfg.vlans.push({ id: vlan[1], name: `VLAN${vlan[1]}` });
      continue;
    }
    const vlanName = t.match(/^name\s+(\S+)/);
    if (vlanName && cfg.vlans.length) {
      cfg.vlans[cfg.vlans.length - 1].name = vlanName[1];
      continue;
    }

    const route = t.match(/^ip route\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (route) {
      cfg.routes.push({
        destination: `${route[1]}${maskToPrefix(route[2])}`,
        nextHop: route[3],
        type: 'static'
      });
      continue;
    }
    const ospf = t.match(/^router\s+(ospf|bgp|eigrp)\s+(\S+)/);
    if (ospf) {
      cfg.routes.push({
        destination: 'learned routes',
        nextHop: `${ospf[1].toUpperCase()} ${ospf[2]}`,
        type: 'dynamic',
        protocol: ospf[1].toUpperCase()
      });
      continue;
    }

    const acl = t.match(/^ip access-list extended\s+(\S+)/);
    if (acl) {
      currentAcl = acl[1];
      continue;
    }

    if (t.startsWith('line vty')) {
      inVty = true;
      continue;
    }
    if (inVty) {
      if (t.startsWith('transport input')) {
        cfg.management.ssh = t.includes('ssh');
        cfg.management.telnet = t.includes('telnet') || t.includes('all');
      }
      const to = t.match(/^exec-timeout\s+(\d+)/);
      if (to) cfg.management.idleTimeoutMinutes = parseInt(to[1], 10);
      if (t.startsWith('access-class')) cfg.management.mgmtAccessRestricted = true;
      continue;
    }

    if (t === 'no ip http-server') cfg.management.http = false;
    if (t === 'ip http-server') cfg.management.http = true;
    if (t === 'ip http secure-server') cfg.management.https = true;
    const sshv = t.match(/^ip ssh version\s+(\d)/);
    if (sshv) {
      cfg.management.ssh = true;
      cfg.management.sshVersion = sshv[1];
    }
    if (/^snmp-server group\s+\S+\s+v3/.test(t)) {
      cfg.snmp.enabled = true;
      cfg.snmp.version = '3';
    }
    const snmpC = t.match(/^snmp-server community\s+(\S+)/);
    if (snmpC) {
      cfg.snmp.enabled = true;
      cfg.snmp.version = '2c';
      cfg.snmp.insecureCommunity = ['public', 'private'].includes(snmpC[1]);
    }
    const log = t.match(/^logging host\s+(\S+)/);
    if (log) {
      cfg.logging.enabled = true;
      cfg.logging.syslogServers.push(log[1]);
    }
    const ntp = t.match(/^ntp server\s+(\S+)/);
    if (ntp) {
      cfg.ntp.enabled = true;
      cfg.ntp.servers.push(ntp[1]);
    }
    const dns = t.match(/^ip name-server\s+(\S+)/);
    if (dns) cfg.dns.servers.push(dns[1]);
    const user = t.match(/^username\s+(\S+)\s+privilege\s+(\d+)/);
    if (user) cfg.aaa.localUsers.push({ name: user[1], privilege: user[2] });
    if (t === 'aaa new-model') cfg.aaa.centralized = true;

    // ACL entries
    if (currentAcl && /^(permit|deny)\s/.test(t)) {
      const tokens = t.split(/\s+/);
      const action = tokens[0] === 'permit' ? 'ALLOW' : 'DENY';
      let proto = tokens[1] as Protocol | 'ip';
      let idx = 2;
      const [src, usedSrc] = readAddress(tokens, idx);
      idx += usedSrc;
      const [dst, usedDst] = readAddress(tokens, idx);
      idx += usedDst;
      let ports = 'any';
      if (tokens[idx] === 'eq') ports = tokens[idx + 1] ?? 'any';
      if (proto === 'ip') proto = 'any';
      const rule: PolicyRule = {
        id: `${currentAcl}-${++seq}`,
        name: `${currentAcl} entry ${seq}`,
        srcZone: zoneForToken(src),
        dstZone: zoneForToken(dst),
        source: src,
        destination: dst,
        protocol: (['tcp', 'udp', 'icmp', 'any'].includes(proto) ? proto : 'any') as Protocol,
        ports,
        action,
        log: t.includes('log'),
        enabled: true,
        seq,
        raw: t,
        kind: 'acl'
      };
      cfg.aclRules.push(rule);
      cfg.firewallRules.push({ ...rule, kind: 'firewall' });
    }
  }

  cfg.secretsRedacted = countSecrets(raw);
  return finalizeZones(cfg);
}