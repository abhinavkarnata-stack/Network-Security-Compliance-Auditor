import type { NormalizedConfig, PolicyRule } from '../../types/nexus';
import {
  countSecrets,
  emptyNormalized,
  finalizeZones,
  serviceToProtoPort,
  zoneForToken } from
'./shared';

interface PolicyDraft {
  from: string;
  to: string;
  name: string;
  destination: string;
  application: string;
  action?: 'ALLOW' | 'DENY';
  log: boolean;
  raw: string[];
}

export function parseJuniper(raw: string, fallbackName = 'Juniper-Device'): NormalizedConfig {
  const cfg = emptyNormalized('Juniper', fallbackName);
  const policies = new Map<string, PolicyDraft>();
  const zoneByInterface = new Map<string, string>();

  for (const rawLine of raw.split('\n')) {
    const t = rawLine.trim();
    if (!t.startsWith('set ')) continue;
    const tk = t.slice(4).split(/\s+/);
    const j = (from: number) => tk.slice(from).join(' ');

    if (tk[0] === 'system') {
      if (tk[1] === 'host-name') {
        cfg.hostname = tk[2];
        cfg.device = tk[2];
      }
      if (tk[1] === 'services') {
        if (tk[2] === 'ssh') {
          cfg.management.ssh = true;
          const v = t.match(/protocol-version\s+v?(\d)/);
          cfg.management.sshVersion = v ? v[1] : 'unspecified';
        }
        if (tk[2] === 'telnet') cfg.management.telnet = true;
        if (tk[2] === 'web-management') {
          if (tk[3] === 'https') cfg.management.https = true;
          if (tk[3] === 'http') cfg.management.http = true;
        }
      }
      if (tk[1] === 'login' && tk[2] === 'user') {
        cfg.aaa.localUsers.push({ name: tk[3], privilege: tk[5] ?? 'unknown' });
      }
      if (tk[1] === 'syslog' && tk[2] === 'host') {
        cfg.logging.enabled = true;
        cfg.logging.syslogServers.push(tk[3]);
      }
      if (tk[1] === 'ntp' && tk[2] === 'server') {
        cfg.ntp.enabled = true;
        cfg.ntp.servers.push(tk[3]);
      }
      if (tk[1] === 'name-server') cfg.dns.servers.push(tk[2]);
      if (tk[1] === 'authentication-order' || tk[1] === 'radius-server') cfg.aaa.centralized = true;
    }

    if (tk[0] === 'interfaces') {
      const name = `${tk[1]}.${tk[3] ?? '0'}`;
      const addrIdx = tk.indexOf('address');
      const descIdx = tk.indexOf('description');
      let iface = cfg.interfaces.find((i) => i.name === name);
      if (!iface) {
        iface = {
          name,
          description: '',
          ipAddress: '',
          zone: 'unassigned',
          allowedManagement: [],
          enabled: true
        };
        cfg.interfaces.push(iface);
      }
      if (descIdx > -1) iface.description = tk[descIdx + 1] ?? '';
      if (addrIdx > -1) {
        iface.ipAddress = tk[addrIdx + 1] ?? '';
        iface.zone = zoneForToken(iface.ipAddress) as never;
      }
    }

    if (tk[0] === 'vlans') {
      cfg.vlans.push({ id: tk[3] ?? '0', name: tk[1] });
    }

    if (tk[0] === 'routing-options' && tk[1] === 'static' && tk[2] === 'route') {
      cfg.routes.push({ destination: tk[3], nextHop: tk[5] ?? '-', type: 'static' });
    }
    if (tk[0] === 'protocols') {
      cfg.routes.push({
        destination: 'learned routes',
        nextHop: `${tk[1].toUpperCase()} ${tk[3] ?? ''}`.trim(),
        type: 'dynamic',
        protocol: tk[1].toUpperCase()
      });
    }

    if (tk[0] === 'security' && tk[1] === 'zones' && tk[2] === 'security-zone') {
      const zone = tk[3];
      const ifIdx = tk.indexOf('interfaces');
      if (ifIdx > -1) {
        zoneByInterface.set(tk[ifIdx + 1], zone);
        const iface = cfg.interfaces.find((i) => i.name === tk[ifIdx + 1]);
        if (iface) iface.zone = zoneForToken(zone) as never;
      }
    }

    if (tk[0] === 'security' && tk[1] === 'policies') {
      if (tk[2] === 'default-policy') {
        cfg.firewallRules.push({
          id: 'jnpr-default',
          name: 'default-policy',
          srcZone: 'any',
          dstZone: 'any',
          source: 'any',
          destination: 'any',
          protocol: 'any',
          ports: 'any',
          action: t.includes('permit') ? 'ALLOW' : 'DENY',
          log: false,
          enabled: true,
          seq: 999,
          raw: t,
          kind: 'firewall'
        });
        continue;
      }
      const fromZone = tk[3];
      const toZone = tk[5];
      const policyName = tk[7];
      const key = `${fromZone}|${toZone}|${policyName}`;
      const draft: PolicyDraft =
      policies.get(key) ??
      {
        from: fromZone,
        to: toZone,
        name: policyName,
        destination: 'any',
        application: 'any',
        log: false,
        raw: []
      };
      draft.raw.push(t);
      if (tk[8] === 'match') {
        const dIdx = tk.indexOf('destination-address');
        if (dIdx > -1) draft.destination = tk[dIdx + 1];
        const aIdx = tk.indexOf('application');
        if (aIdx > -1) draft.application = tk[aIdx + 1];
      }
      if (tk[8] === 'then') {
        draft.action = j(9).includes('permit') ? 'ALLOW' : 'DENY';
        draft.log = j(9).includes('log');
      }
      policies.set(key, draft);
    }

    if (tk[0] === 'security' && tk[1] === 'nat') {
      cfg.natRules.push({
        id: `nat-${cfg.natRules.length + 1}`,
        name: tk[4] ?? 'rule-set',
        type: tk[2] === 'source' ? 'source' : 'destination',
        original: `${tk[tk.indexOf('from') + 2] ?? '-'}`,
        translated: `${tk[tk.indexOf('to') + 2] ?? '-'}`,
        ports: 'any',
        raw: t
      });
    }

    if (tk[0] === 'security' && tk[1] === 'ike' && tk[2] === 'gateway') {
      cfg.vpnConnections.push({
        id: `vpn-${tk[3]}`,
        name: tk[3],
        peer: tk[tk.indexOf('address') + 1] ?? 'unknown',
        type: 'site-to-site',
        localZone: 'Vendor',
        remoteParty: tk[3].replace(/-VPN$/i, ''),
        encryption: 'ike (see ipsec policy)'
      });
    }

    if (tk[0] === 'snmp' && tk[1] === 'community') {
      cfg.snmp.enabled = true;
      cfg.snmp.version = '1/2c';
      cfg.snmp.insecureCommunity = ['public', 'private'].includes(tk[2]);
    }
    if (tk[0] === 'snmp' && tk[1] === 'v3') {
      cfg.snmp.enabled = true;
      cfg.snmp.version = '3';
    }
  }

  let seq = 0;
  policies.forEach((p) => {
    const svc = serviceToProtoPort(p.application);
    const rule: PolicyRule = {
      id: `jnpr-${p.name}`,
      name: p.name,
      srcZone: zoneForToken(p.from),
      dstZone: zoneForToken(p.to),
      source: 'any',
      destination: p.destination,
      protocol: svc.protocol,
      ports: svc.ports,
      action: p.action ?? 'DENY',
      log: p.log,
      enabled: true,
      seq: ++seq,
      raw: p.raw.join('\n'),
      kind: 'firewall'
    };
    cfg.firewallRules.unshift(rule);
  });
  cfg.firewallRules.sort((a, b) => a.seq - b.seq);

  cfg.secretsRedacted = countSecrets(raw);
  return finalizeZones(cfg);
}