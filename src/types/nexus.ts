export type Vendor = 'Cisco' | 'Fortinet' | 'Juniper' | 'Palo Alto';

export type Zone =
'Internet' |
'DMZ' |
'Application' |
'Database' |
'Management' |
'Vendor' |
'Cloud';

export type Environment = 'Production' | 'Development' | 'DMZ' | 'Cloud';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type PolicyAction = 'ALLOW' | 'DENY';

export type Protocol = 'tcp' | 'udp' | 'icmp' | 'any';

export type Role = 'Administrator' | 'Security Analyst' | 'Auditor';

export type Framework = 'CIS' | 'NIST' | 'ISO 27001' | 'PCI DSS' | 'Custom Policy';

/* ---------------------------------- auth ---------------------------------- */

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  passwordDigest: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
}

/* ------------------------------ normalized model --------------------------- */

export interface NormalizedInterface {
  name: string;
  description: string;
  ipAddress: string;
  zone: Zone | 'unassigned';
  allowedManagement: string[];
  enabled: boolean;
}

export interface NormalizedRoute {
  destination: string;
  nextHop: string;
  type: 'static' | 'dynamic';
  protocol?: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  srcZone: Zone | 'any';
  dstZone: Zone | 'any';
  source: string;
  destination: string;
  protocol: Protocol;
  ports: string;
  action: PolicyAction;
  log: boolean;
  enabled: boolean;
  seq: number;
  raw: string;
  kind: 'firewall' | 'acl';
}

export interface NatRule {
  id: string;
  name: string;
  type: 'source' | 'destination';
  original: string;
  translated: string;
  ports: string;
  raw: string;
}

export interface VpnConnection {
  id: string;
  name: string;
  peer: string;
  type: 'site-to-site' | 'remote-access' | 'cloud';
  localZone: Zone | 'any';
  remoteParty: string;
  encryption: string;
}

export interface NormalizedConfig {
  device: string;
  vendor: Vendor;
  hostname: string;
  interfaces: NormalizedInterface[];
  ipAddresses: string[];
  vlans: {id: string;name: string;}[];
  zones: Zone[];
  routes: NormalizedRoute[];
  firewallRules: PolicyRule[];
  aclRules: PolicyRule[];
  natRules: NatRule[];
  vpnConnections: VpnConnection[];
  management: {
    ssh: boolean;
    sshVersion: string;
    telnet: boolean;
    https: boolean;
    http: boolean;
    mgmtAccessRestricted: boolean;
    idleTimeoutMinutes: number;
  };
  logging: {enabled: boolean;syslogServers: string[];};
  snmp: {enabled: boolean;version: string;insecureCommunity: boolean;};
  ntp: {enabled: boolean;servers: string[];};
  dns: {servers: string[];};
  aaa: {centralized: boolean;localUsers: {name: string;privilege: string;}[];};
  secretsRedacted: number;
}

/* --------------------------------- entities -------------------------------- */

export interface Device {
  id: string;
  orgId: string;
  name: string;
  vendor: Vendor;
  type: 'Router' | 'Firewall' | 'Switch' | 'Load Balancer';
  ip: string;
  environment: Environment;
  compliance: number;
  risk: Severity;
  lastScan: string | null;
  status: 'Healthy' | 'Warning' | 'Critical' | 'Unscanned';
}

export interface Configuration {
  id: string;
  orgId: string;
  deviceId: string;
  deviceName: string;
  vendor: Vendor;
  environment: Environment;
  fileName: string;
  raw: string;
  normalized: NormalizedConfig;
  uploadedAt: string;
  version: number;
}

export interface ConfigurationSnapshot {
  id: string;
  orgId: string;
  deviceId: string;
  deviceName: string;
  configurationId: string;
  label: string;
  normalized: NormalizedConfig;
  takenAt: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: Severity;
  field?: string;
  operator: 'equals' | 'notEquals' | 'gte' | 'lte' | 'nonEmpty' | 'custom';
  expected?: unknown;
  frameworks: Partial<Record<Framework, string>>;
  remediationHint: string;
}

export interface RuleResult {
  ruleId: string;
  deviceId: string;
  deviceName: string;
  vendor: Vendor;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
  detail: string;
}

export interface NetworkIntent {
  id: string;
  orgId: string;
  source: Zone;
  destination: Zone;
  protocol: Protocol;
  port: string;
  action: PolicyAction;
  environment: Environment;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
}

export interface Asset {
  id: string;
  orgId: string;
  name: string;
  zone: Zone;
  criticality: 'Critical' | 'Sensitive' | 'Standard';
  ip: string;
  type: string;
}

export interface ThirdPartyVendor {
  id: string;
  orgId: string;
  name: string;
  connectionType: 'VPN' | 'API' | 'Direct Circuit';
  service: string;
  connections: {source: string;destination: string;protocol: Protocol;port: string;}[];
  entryZone: Zone;
  entryAsset: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  kind: 'DEPENDS_ON' | 'CONNECTS_TO' | 'ROUTES_TO' | 'ALLOWS' | 'DENIES';
  label?: string;
}

export interface ReachabilityHop {
  node: string;
  device?: string;
  ruleName?: string;
  decision?: PolicyAction;
}

export interface ReachabilityResult {
  source: Zone;
  destination: Zone;
  protocol: Protocol;
  port: string;
  reachable: boolean;
  kind: 'direct' | 'indirect' | 'blocked';
  paths: {hops: ReachabilityHop[];reachable: boolean;blockedBy?: ReachabilityHop;}[];
}

export interface DriftEvent {
  id: string;
  orgId: string;
  deviceId: string;
  deviceName: string;
  severity: Severity;
  field: string;
  previous: string;
  current: string;
  intent?: string;
  detectedAt: string;
  fromSnapshot: string;
  toSnapshot: string;
}

export type FindingCategory =
'Compliance' |
'Intent Violation' |
'Segmentation' |
'Reachability' |
'Third-Party' |
'Drift';

export interface AIExplanation {
  whatHappened: string;
  whyItMatters: string;
  potentialImpact: string;
  complianceImplications: string;
  recommendation: string;
  generatedAt: string;
  model: string;
}

export interface Remediation {
  id: string;
  vendor: Vendor | 'N/A';
  recommendation: string;
  commands: string[];
  generatedAt: string;
}

export interface Finding {
  id: string;
  orgId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  deviceId?: string;
  deviceName?: string;
  vendor?: Vendor;
  environment?: Environment;
  status: 'Open' | 'Investigating' | 'Resolved';
  ruleId?: string;
  frameworks: Framework[];
  summary: string;
  evidence: {label: string;value: string;}[];
  intent?: string;
  actual?: string;
  path?: ReachabilityHop[];
  affectedAssets: string[];
  riskWeight: number;
  createdAt: string;
  aiExplanation?: AIExplanation;
  remediation?: Remediation;
}

export interface RiskScores {
  overall: number;
  compliance: number;
  exposure: number;
  thirdParty: number;
  drift: number;
  calculatedAt: string;
}

export interface AuditRun {
  id: string;
  orgId: string;
  startedAt: string;
  devices: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  driftEvents: number;
  thirdPartyRisks: number;
  scoreBefore: number;
  scoreAfter: number;
  trigger: string;
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export interface Report {
  id: string;
  orgId: string;
  type:
  'Security Audit' |
  'Compliance' |
  'Reachability' |
  'Third-Party Risk' |
  'Drift' |
  'Remediation';
  title: string;
  generatedAt: string;
  generatedBy: string;
  payload: Record<string, unknown>;
}

export interface Alert {
  id: string;
  orgId: string;
  severity: Severity;
  message: string;
  at: string;
  findingId?: string;
}

export interface TopologyEdgeDef {
  from: Zone;
  to: Zone;
  guard: string;
  label: string;
}