import type { NormalizedConfig, PolicyRule } from '../../types/nexus';
import {
  countSecrets,
  emptyNormalized,
  finalizeZones,
  serviceToProtoPort,
  zoneForToken } from
'./shared';

function after(tokens: string[], key: string): string | undefined {
  const i = tokens.indexOf(key);
  return i > -1 ? tokens[i + 1] : undefined;
}

export function parsePaloAlto(raw: string, fallbackName = 'PaloAlto-Device'): NormalizedConfig {
  const cfg = emptyNormalized('Palo Alto', fallbackName);
  cfg.management.ssh = true;
  let seq = 0;

  for (const rawLine of raw.split('\n')) {
    const t = rawLine.trim();
    if (!t.startsWith('set ')) continue;
    const tk = t.slice(4).split(/\s+/);

    if (tk[0] === 'deviceconfig' && tk[1] === 'system') {
      if (tk[2] === 'hostname') {
        cfg.hostname = tk[3];
        cfg.device = tk[3];
      }
      if (tk[2] === 'service') {
        const on = tk[4] === 'yes';
        if (tk[3] === 'disable-telnet') cfg.management.telnet = !on;
        if (tk[3] === 'disable-http') cfg.management.http = !on;
        if (tk[3] === 'disable-https') cfg.management.https = !on;
        if (tk[3] === 'disable-ssh') cfg.management.ssh = !on;
      }
      if (tk[2] === 'permitted-ip') cfg.management.mgmtAccessRestricted = true;
      if (tk[2] === 'idle-timeout') cfg.management.idleTimeoutMinutes = parseInt(tk[3], 10) || 0;
      if (tk[2] === 'snmp-setting') {
        cfg.snmp.enabled = true;
        const v = t.match(/version\s+v?(\d)/);
        cfg.snmp.version = v ? v[1] : '3';
        cfg.snmp.insecureCommunity = /community/.test(t) && /public|private/.test(t);
      }
      if (tk[2] === 'ntp-servers') {
        cfg.ntp.enabled = true;
        cfg.ntp.servers.push(tk[tk.length - 1]);
      }
      if (tk[2] === 'dns-setting') cfg.dns.servers.push(tk[tk.length - 1]);
      if (tk[2] === 'authentication-profile') cfg.aaa.centralized = true;
    }

    if (tk[0] === 'mgt-config' && tk[1] === 'users') {
      cfg.aaa.localUsers.push({ name: tk[2], privilege: 'superuser' });
    }

    if (tk[0] === 'network' && tk[1] === 'interface' && tk[2] === 'ethernet') {
      const ip = after(tk, 'ip') ?? '';
      cfg.interfaces.push({
        name: tk[3],
        description: after(tk, 'comment') ?? '',
        ipAddress: ip,
        zone: zoneForToken(ip) as never,
        allowedManagement: [],
        enabled: true
      });
    }

    if (tk[0] === 'zone') {
      const zone = zoneForToken(tk[1]);
      const iface = tk[tk.length - 1];
      const match = cfg.interfaces.find((i) => i.name === iface);
      if (match && zone !== 'any') match.zone = zone as never;
    }

    if (tk[0] === 'network' && tk[1] === 'virtual-router') {
      const dest = after(tk, 'destination');
      const nh = after(tk, 'ip-address');
      if (dest) cfg.routes.push({ destination: dest, nextHop: nh ?? '-', type: 'static' });
    }

    if (tk[0] === 'rulebase' && tk[1] === 'security' && tk[2] === 'rules') {
      const name = tk[3];
      const svc = serviceToProtoPort(after(tk, 'service') ?? 'any');
      const rule: PolicyRule = {
        id: `pan-${name}`,
        name,
        srcZone: zoneForToken(after(tk, 'from') ?? 'any'),
        dstZone: zoneForToken(after(tk, 'to') ?? 'any'),
        source: after(tk, 'source') ?? 'any',
        destination: after(tk, 'destination') ?? 'any',
        protocol: svc.protocol,
        ports: svc.ports,
        action: (after(tk, 'action') ?? 'deny') === 'allow' ? 'ALLOW' : 'DENY',
        log: after(tk, 'log-end') === 'yes',
        enabled: true,
        seq: ++seq,
        raw: t,
        kind: 'firewall'
      };
      cfg.firewallRules.push(rule);
    }

    if (tk[0] === 'rulebase' && tk[1] === 'nat') {
      cfg.natRules.push({
        id: `nat-${tk[3]}`,
        name: tk[3],
        type: t.includes('source-translation') ? 'source' : 'destination',
        original: after(tk, 'from') ?? '-',
        translated: after(tk, 'interface-address') ?? after(tk, 'to') ?? '-',
        ports: 'any',
        raw: t
      });
    }

    if (tk[0] === 'shared' && tk[1] === 'log-settings') {
      cfg.logging.enabled = true;
      const server = after(tk, 'server');
      if (server) cfg.logging.syslogServers.push(server);
    }

    if (tk[0] === 'network' && tk[1] === 'tunnel') {
      cfg.vpnConnections.push({
        id: `vpn-${tk[3] ?? 'tunnel'}`,
        name: tk[3] ?? 'tunnel',
        peer: after(tk, 'peer-address') ?? 'unknown',
        type: 'cloud',
        localZone: 'Cloud',
        remoteParty: 'Cloud provider',
        encryption: 'ipsec'
      });
    }
  }

  cfg.secretsRedacted = countSecrets(raw);
  return finalizeZones(cfg);
}