import type {
  Asset,
  DependencyEdge,
  Environment,
  NetworkIntent,
  ThirdPartyVendor,
  TopologyEdgeDef,
  Vendor } from
'../types/nexus';
import {
  CISCO_CORE_01,
  FORTINET_FW_01,
  JUNIPER_EDGE_01,
  PALOALTO_FW_02 } from
'./rawConfigs';

export interface DeviceSeed {
  name: string;
  vendor: Vendor;
  type: 'Router' | 'Firewall' | 'Switch' | 'Load Balancer';
  ip: string;
  environment: Environment;
  raw: string;
}

function rename(raw: string, from: string, to: string): string {
  return raw.split(from).join(to);
}

/** Weakens or hardens a cloned configuration so the fleet has realistic variance. */
function mutate(raw: string, ops: ('add-telnet' | 'drop-logging' | 'weak-snmp' | 'broad-permit' | 'harden')[]) {
  let out = raw;
  ops.forEach((op) => {
    if (op === 'add-telnet') {
      out = out.
      replace('transport input ssh', 'transport input ssh telnet').
      replace('set system services ssh protocol-version v2', 'set system services ssh protocol-version v2\nset system services telnet');
    }
    if (op === 'drop-logging') {
      out = out.
      replace(/^logging host.*$/m, '! logging host not configured').
      replace(/\s*set status enable\n\s*set syslog-server \S+/m, '\n    set status disable');
    }
    if (op === 'weak-snmp') {
      out = out.replace('snmp-server group NEXUS-RO v3 priv', 'snmp-server community public RO');
    }
    if (op === 'broad-permit') {
      out = out.replace(
        'ip access-list extended APP-TO-DB',
        'ip access-list extended ANY-ANY\n permit ip any any\n!\nip access-list extended APP-TO-DB'
      );
    }
    if (op === 'harden') {
      out = out.
      replace('set admin-telnet enable', 'set admin-telnet disable').
      replace('set trusthost1 0.0.0.0 0.0.0.0', 'set trusthost1 10.0.0.0 255.255.255.0').
      replace('set admintimeout 480', 'set admintimeout 600');
    }
  });
  return out;
}

export const DEMO_DEVICES: DeviceSeed[] = [
{
  name: 'Cisco-Core-01',
  vendor: 'Cisco',
  type: 'Router',
  ip: '10.0.0.1',
  environment: 'Production',
  raw: CISCO_CORE_01
},
{
  name: 'Fortinet-FW-01',
  vendor: 'Fortinet',
  type: 'Firewall',
  ip: '10.0.0.10',
  environment: 'Production',
  raw: FORTINET_FW_01
},
{
  name: 'Juniper-Edge-01',
  vendor: 'Juniper',
  type: 'Router',
  ip: '10.0.1.1',
  environment: 'DMZ',
  raw: JUNIPER_EDGE_01
},
{
  name: 'PaloAlto-FW-02',
  vendor: 'Palo Alto',
  type: 'Firewall',
  ip: '10.0.2.10',
  environment: 'Cloud',
  raw: PALOALTO_FW_02
},
{
  name: 'Cisco-Access-02',
  vendor: 'Cisco',
  type: 'Switch',
  ip: '10.0.0.2',
  environment: 'Production',
  raw: mutate(rename(CISCO_CORE_01, 'Cisco-Core-01', 'Cisco-Access-02'), ['weak-snmp'])
},
{
  name: 'Cisco-Edge-03',
  vendor: 'Cisco',
  type: 'Router',
  ip: '10.0.10.3',
  environment: 'DMZ',
  raw: mutate(rename(CISCO_CORE_01, 'Cisco-Core-01', 'Cisco-Edge-03'), [
  'add-telnet',
  'broad-permit']
  )
},
{
  name: 'Cisco-Dev-05',
  vendor: 'Cisco',
  type: 'Router',
  ip: '10.0.60.5',
  environment: 'Development',
  raw: mutate(rename(CISCO_CORE_01, 'Cisco-Core-01', 'Cisco-Dev-05'), ['drop-logging'])
},
{
  name: 'Fortinet-FW-03',
  vendor: 'Fortinet',
  type: 'Firewall',
  ip: '10.0.60.10',
  environment: 'Development',
  raw: rename(FORTINET_FW_01, 'Fortinet-FW-01', 'Fortinet-FW-03')
},
{
  name: 'Fortinet-FW-05',
  vendor: 'Fortinet',
  type: 'Firewall',
  ip: '10.100.0.10',
  environment: 'Cloud',
  raw: mutate(rename(FORTINET_FW_01, 'Fortinet-FW-01', 'Fortinet-FW-05'), ['harden'])
},
{
  name: 'Juniper-Core-02',
  vendor: 'Juniper',
  type: 'Router',
  ip: '10.0.1.2',
  environment: 'Production',
  raw: rename(JUNIPER_EDGE_01, 'Juniper-Edge-01', 'Juniper-Core-02')
},
{
  name: 'Juniper-Access-03',
  vendor: 'Juniper',
  type: 'Switch',
  ip: '10.0.10.4',
  environment: 'DMZ',
  raw: mutate(rename(JUNIPER_EDGE_01, 'Juniper-Edge-01', 'Juniper-Access-03'), ['add-telnet'])
},
{
  name: 'PaloAlto-FW-04',
  vendor: 'Palo Alto',
  type: 'Firewall',
  ip: '10.100.0.20',
  environment: 'Cloud',
  raw: rename(PALOALTO_FW_02, 'PaloAlto-FW-02', 'PaloAlto-FW-04')
}];


/**
 * Zone adjacency of the modelled network. Each edge names the device whose
 * policy set governs traffic crossing it — the reachability engine walks these.
 */
export const TOPOLOGY_EDGES: TopologyEdgeDef[] = [
{ from: 'Internet', to: 'DMZ', guard: 'Fortinet-FW-01', label: 'Perimeter' },
{ from: 'DMZ', to: 'Application', guard: 'Fortinet-FW-01', label: 'Inside' },
{ from: 'Application', to: 'Database', guard: 'PaloAlto-FW-02', label: 'Data tier' },
{ from: 'Internet', to: 'Management', guard: 'Fortinet-FW-01', label: 'Out-of-band' },
{ from: 'Management', to: 'Application', guard: 'Cisco-Core-01', label: 'Core transit' },
{ from: 'Management', to: 'Database', guard: 'PaloAlto-FW-02', label: 'Admin access' },
{ from: 'Vendor', to: 'Management', guard: 'Juniper-Edge-01', label: 'Vendor VPN' },
{ from: 'Vendor', to: 'Application', guard: 'Juniper-Edge-01', label: 'Vendor transit' },
{ from: 'DMZ', to: 'Management', guard: 'Juniper-Edge-01', label: 'Edge mgmt' },
{ from: 'Cloud', to: 'Database', guard: 'PaloAlto-FW-02', label: 'Replication' }];


export const DEMO_INTENTS: Omit<NetworkIntent, 'id' | 'orgId'>[] = [
{
  source: 'Internet',
  destination: 'Database',
  protocol: 'tcp',
  port: '3306',
  action: 'DENY',
  environment: 'Production',
  priority: 'Critical',
  description: 'Production data stores must never be reachable from untrusted networks.'
},
{
  source: 'Application',
  destination: 'Database',
  protocol: 'tcp',
  port: '3306',
  action: 'ALLOW',
  environment: 'Production',
  priority: 'High',
  description: 'Application tier requires MySQL access to the production database.'
},
{
  source: 'Management',
  destination: 'Database',
  protocol: 'tcp',
  port: '3306',
  action: 'ALLOW',
  environment: 'Production',
  priority: 'Medium',
  description: 'Administrators require MySQL access to production data from the admin network.'
},
{
  source: 'Internet',
  destination: 'Management',
  protocol: 'tcp',
  port: '22',
  action: 'DENY',
  environment: 'Production',
  priority: 'Critical',
  description: 'Management plane must not be exposed to the Internet.'
},
{
  source: 'Internet',
  destination: 'DMZ',
  protocol: 'tcp',
  port: '443',
  action: 'ALLOW',
  environment: 'DMZ',
  priority: 'High',
  description: 'Public web service is published over HTTPS.'
},
{
  source: 'Vendor',
  destination: 'Database',
  protocol: 'tcp',
  port: '3306',
  action: 'DENY',
  environment: 'Production',
  priority: 'Critical',
  description: 'Third parties must never reach production data directly or indirectly.'
},
{
  source: 'Vendor',
  destination: 'Management',
  protocol: 'tcp',
  port: '22',
  action: 'ALLOW',
  environment: 'Production',
  priority: 'Medium',
  description: 'Vendor A maintenance is permitted to the jump server over SSH only.'
},
{
  source: 'DMZ',
  destination: 'Database',
  protocol: 'tcp',
  port: '3306',
  action: 'DENY',
  environment: 'Production',
  priority: 'High',
  description: 'DMZ workloads must reach data only via the application tier.'
}];


export const DEMO_ASSETS: Omit<Asset, 'id' | 'orgId'>[] = [
{ name: 'Internet', zone: 'Internet', criticality: 'Standard', ip: '0.0.0.0/0', type: 'External network' },
{ name: 'DMZ Segment', zone: 'DMZ', criticality: 'Standard', ip: '10.0.10.0/24', type: 'Network segment' },
{ name: 'Web Server', zone: 'DMZ', criticality: 'Sensitive', ip: '10.0.10.20', type: 'Server' },
{ name: 'Application Server', zone: 'Application', criticality: 'Critical', ip: '10.0.20.20', type: 'Server' },
{ name: 'Production Database', zone: 'Database', criticality: 'Critical', ip: '10.0.30.20', type: 'Database' },
{ name: 'Admin Network', zone: 'Management', criticality: 'Sensitive', ip: '10.0.0.0/24', type: 'Network segment' },
{ name: 'Jump Server', zone: 'Management', criticality: 'Critical', ip: '10.0.0.30', type: 'Bastion host' },
{ name: 'Cloud Replica', zone: 'Cloud', criticality: 'Sensitive', ip: '10.100.0.40', type: 'Database replica' },
{ name: 'Vendor Network', zone: 'Vendor', criticality: 'Standard', ip: '172.16.50.0/24', type: 'Third-party network' }];


export const ASSET_EDGES: DependencyEdge[] = [
{ from: 'Vendor Network', to: 'Jump Server', kind: 'CONNECTS_TO', label: 'VPN / SSH 22' },
{ from: 'Jump Server', to: 'Application Server', kind: 'DEPENDS_ON', label: 'admin session' },
{ from: 'Jump Server', to: 'Production Database', kind: 'DEPENDS_ON', label: 'admin session' },
{ from: 'Application Server', to: 'Production Database', kind: 'DEPENDS_ON', label: 'MySQL 3306' },
{ from: 'Web Server', to: 'Application Server', kind: 'DEPENDS_ON', label: 'HTTPS 443' },
{ from: 'Internet', to: 'Web Server', kind: 'CONNECTS_TO', label: 'HTTPS 443' },
{ from: 'Production Database', to: 'Cloud Replica', kind: 'DEPENDS_ON', label: 'replication' },
{ from: 'Admin Network', to: 'Jump Server', kind: 'CONNECTS_TO', label: 'SSH 22' }];


export const DEMO_VENDORS: Omit<ThirdPartyVendor, 'id' | 'orgId'>[] = [
{
  name: 'Vendor A',
  connectionType: 'VPN',
  service: 'Managed network operations',
  entryZone: 'Vendor',
  entryAsset: 'Jump Server',
  connections: [
  { source: 'Vendor Network', destination: 'Jump Server', protocol: 'tcp', port: '22' },
  { source: 'Vendor Network', destination: 'Jump Server', protocol: 'tcp', port: '3389' },
  { source: 'Vendor Network', destination: 'Application Server', protocol: 'any', port: 'any' }]

},
{
  name: 'Vendor B',
  connectionType: 'API',
  service: 'Payment processing gateway',
  entryZone: 'DMZ',
  entryAsset: 'Web Server',
  connections: [{ source: 'Vendor Network', destination: 'Web Server', protocol: 'tcp', port: '443' }]
},
{
  name: 'Vendor C',
  connectionType: 'Direct Circuit',
  service: 'Offsite backup and replication',
  entryZone: 'Cloud',
  entryAsset: 'Cloud Replica',
  connections: [{ source: 'Vendor Network', destination: 'Cloud Replica', protocol: 'tcp', port: '3306' }]
}];


/** The drift the demo injects: an emergency permit that contradicts intent. */
export const DRIFT_INJECTION = {
  deviceName: 'Fortinet-FW-01',
  anchor: 'config firewall policy\n',
  editBlock: `    edit 0
        set name "TEMP-Emergency-DB-Access"
        set srcintf "Internet"
        set dstintf "Database"
        set srcaddr "all"
        set dstaddr "Prod-DB"
        set service "MYSQL"
        set action accept
        set logtraffic disable
    next
`
};