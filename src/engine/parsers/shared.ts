import type { NormalizedConfig, Protocol, Vendor, Zone } from '../../types/nexus';

/** Logical zone map for the modelled network. Used to resolve raw addresses to zones. */
export const ZONE_SUBNETS: {prefix: string;zone: Zone;label: string;}[] = [
{ prefix: '10.0.0.', zone: 'Management', label: '10.0.0.0/24 Admin / Management' },
{ prefix: '10.0.10.', zone: 'DMZ', label: '10.0.10.0/24 DMZ' },
{ prefix: '10.0.20.', zone: 'Application', label: '10.0.20.0/24 Application tier' },
{ prefix: '10.0.30.', zone: 'Database', label: '10.0.30.0/24 Database tier' },
{ prefix: '172.16.50.', zone: 'Vendor', label: '172.16.50.0/24 Vendor transit' },
{ prefix: '10.100.', zone: 'Cloud', label: '10.100.0.0/16 Cloud interconnect' },
{ prefix: '203.0.113.', zone: 'Internet', label: '203.0.113.0/24 Public edge' },
{ prefix: '198.51.100.', zone: 'Internet', label: '198.51.100.0/24 Public peer' }];


const NAMED_ZONES: Record<string, Zone> = {
  internet: 'Internet',
  wan: 'Internet',
  wan1: 'Internet',
  untrust: 'Internet',
  dmz: 'DMZ',
  application: 'Application',
  app: 'Application',
  'app-servers': 'Application',
  'application-servers': 'Application',
  database: 'Database',
  db: 'Database',
  'prod-db': 'Database',
  management: 'Management',
  mgmt: 'Management',
  'admin-network': 'Management',
  'jump-server': 'Management',
  vendor: 'Vendor',
  'vendor-network': 'Vendor',
  cloud: 'Cloud',
  'cloud-replica': 'Cloud',
  'web-server': 'DMZ'
};

export function zoneForToken(token: string): Zone | 'any' {
  if (!token) return 'any';
  const t = token.trim().toLowerCase().replace(/"/g, '');
  if (t === 'any' || t === 'all' || t === '0.0.0.0' || t === '0.0.0.0/0') return 'any';
  if (NAMED_ZONES[t]) return NAMED_ZONES[t];
  const ip = t.split('/')[0];
  const hit = ZONE_SUBNETS.find((z) => ip.startsWith(z.prefix));
  return hit ? hit.zone : 'any';
}

export function zoneForAddress(addr: string): Zone | 'any' {
  return zoneForToken(addr);
}

const SERVICE_MAP: Record<string, {protocol: Protocol;ports: string;}> = {
  all: { protocol: 'any', ports: 'any' },
  any: { protocol: 'any', ports: 'any' },
  https: { protocol: 'tcp', ports: '443' },
  http: { protocol: 'tcp', ports: '80' },
  ssh: { protocol: 'tcp', ports: '22' },
  telnet: { protocol: 'tcp', ports: '23' },
  mysql: { protocol: 'tcp', ports: '3306' },
  rdp: { protocol: 'tcp', ports: '3389' },
  dns: { protocol: 'udp', ports: '53' },
  ntp: { protocol: 'udp', ports: '123' },
  snmp: { protocol: 'udp', ports: '161' },
  ping: { protocol: 'icmp', ports: 'any' },
  'junos-ssh': { protocol: 'tcp', ports: '22' },
  'junos-rdp': { protocol: 'tcp', ports: '3389' },
  'junos-https': { protocol: 'tcp', ports: '443' },
  'junos-mysql': { protocol: 'tcp', ports: '3306' }
};

export function serviceToProtoPort(service: string): {protocol: Protocol;ports: string;} {
  const s = (service || 'any').trim().toLowerCase().replace(/"/g, '');
  if (SERVICE_MAP[s]) return SERVICE_MAP[s];
  const m = s.match(/^(tcp|udp)[-_/:](\d+)$/);
  if (m) return { protocol: m[1] as Protocol, ports: m[2] };
  const portOnly = s.match(/^(\d+)$/);
  if (portOnly) return { protocol: 'tcp', ports: portOnly[1] };
  return { protocol: 'any', ports: 'any' };
}

export const PORT_NAMES: Record<string, string> = {
  '22': 'SSH',
  '23': 'Telnet',
  '80': 'HTTP',
  '443': 'HTTPS',
  '3306': 'MySQL',
  '3389': 'RDP'
};

const SECRET_PATTERNS = [
/secret\s+\d?\s*\$?\S+/i,
/password\s+ENC\s+\S+/i,
/psksecret\s+\S+/i,
/encrypted-password\s+\S+/i,
/phash\s+\S+/i,
/enable secret/i,
/pre-shared-key\s+\S+/i];


export function countSecrets(raw: string): number {
  return raw.
  split('\n').
  filter((l) => SECRET_PATTERNS.some((p) => p.test(l))).length;
}

export function emptyNormalized(vendor: Vendor, device: string): NormalizedConfig {
  return {
    device,
    vendor,
    hostname: device,
    interfaces: [],
    ipAddresses: [],
    vlans: [],
    zones: [],
    routes: [],
    firewallRules: [],
    aclRules: [],
    natRules: [],
    vpnConnections: [],
    management: {
      ssh: false,
      sshVersion: 'unknown',
      telnet: false,
      https: false,
      http: false,
      mgmtAccessRestricted: false,
      idleTimeoutMinutes: 0
    },
    logging: { enabled: false, syslogServers: [] },
    snmp: { enabled: false, version: 'none', insecureCommunity: false },
    ntp: { enabled: false, servers: [] },
    dns: { servers: [] },
    aaa: { centralized: false, localUsers: [] },
    secretsRedacted: 0
  };
}

export function finalizeZones(cfg: NormalizedConfig): NormalizedConfig {
  const zones = new Set<Zone>();
  cfg.interfaces.forEach((i) => {
    if (i.zone !== 'unassigned') zones.add(i.zone);
  });
  cfg.firewallRules.concat(cfg.aclRules).forEach((r) => {
    if (r.srcZone !== 'any') zones.add(r.srcZone);
    if (r.dstZone !== 'any') zones.add(r.dstZone);
  });
  cfg.zones = Array.from(zones);
  cfg.ipAddresses = cfg.interfaces.map((i) => i.ipAddress).filter(Boolean);
  return cfg;
}

export function ruleText(r: {
  action: string;
  srcZone: string;
  dstZone: string;
  protocol: string;
  ports: string;
}): string {
  return `${r.action} ${r.srcZone} → ${r.dstZone} ${r.protocol.toUpperCase()}/${r.ports}`;
}