import type { ComplianceRule, Framework } from '../types/nexus';

export const FRAMEWORKS: Framework[] = ['CIS', 'NIST', 'ISO 27001', 'PCI DSS', 'Custom Policy'];

export const FRAMEWORK_DESCRIPTIONS: Record<Framework, string> = {
  CIS: 'CIS Critical Security Controls v8',
  NIST: 'NIST Cybersecurity Framework 2.0',
  'ISO 27001': 'ISO/IEC 27001:2022 Annex A',
  'PCI DSS': 'PCI DSS v4.0',
  'Custom Policy': 'Organization network security policy'
};

/**
 * Deterministic compliance rule set. The engine evaluates these against the
 * normalized model — the AI layer never decides PASS/FAIL.
 */
export const COMPLIANCE_RULES: ComplianceRule[] = [
{
  id: 'NET-001',
  name: 'Telnet disabled',
  description: 'Telnet transmits management credentials in cleartext and must be disabled.',
  category: 'Secure Management',
  severity: 'HIGH',
  field: 'management.telnet',
  operator: 'equals',
  expected: false,
  frameworks: { CIS: '4.8', NIST: 'PR.AC-3', 'ISO 27001': 'A.8.20', 'PCI DSS': '2.2.7' },
  remediationHint: 'Disable the telnet service and allow SSH only for CLI administration.'
},
{
  id: 'NET-002',
  name: 'SSH enabled for administration',
  description: 'Encrypted CLI administration must be available on every managed device.',
  category: 'Secure Management',
  severity: 'MEDIUM',
  field: 'management.ssh',
  operator: 'equals',
  expected: true,
  frameworks: { CIS: '4.8', NIST: 'PR.AC-3', 'ISO 27001': 'A.8.20' },
  remediationHint: 'Enable the SSH service and restrict it to the management network.'
},
{
  id: 'NET-003',
  name: 'SSH version 2 enforced',
  description: 'SSHv1 contains cryptographic weaknesses and must not be accepted.',
  category: 'Secure Management',
  severity: 'MEDIUM',
  field: 'management.sshVersion',
  operator: 'custom',
  frameworks: { CIS: '4.8', NIST: 'PR.DS-2', 'ISO 27001': 'A.8.24' },
  remediationHint: 'Force protocol version 2 on the SSH service.'
},
{
  id: 'NET-004',
  name: 'Plaintext HTTP administration disabled',
  description: 'Web administration must use TLS only.',
  category: 'Secure Management',
  severity: 'HIGH',
  field: 'management.http',
  operator: 'equals',
  expected: false,
  frameworks: { CIS: '4.8', NIST: 'PR.DS-2', 'PCI DSS': '4.2.1' },
  remediationHint: 'Disable the HTTP server and publish administration over HTTPS only.'
},
{
  id: 'NET-005',
  name: 'Management access restricted by source',
  description: 'Administrative access must be limited to authorized management networks.',
  category: 'Management Exposure',
  severity: 'CRITICAL',
  field: 'management.mgmtAccessRestricted',
  operator: 'equals',
  expected: true,
  frameworks: { CIS: '4.6', NIST: 'PR.AC-4', 'ISO 27001': 'A.8.2', 'PCI DSS': '7.2.1' },
  remediationHint: 'Apply a trusted-host / permitted-IP list or management ACL.'
},
{
  id: 'NET-006',
  name: 'Administrative idle timeout <= 15 minutes',
  description: 'Idle administrative sessions must expire promptly.',
  category: 'Secure Management',
  severity: 'LOW',
  field: 'management.idleTimeoutMinutes',
  operator: 'custom',
  frameworks: { CIS: '4.3', 'ISO 27001': 'A.8.5', 'PCI DSS': '8.6.1' },
  remediationHint: 'Set the administrative idle timeout to 15 minutes or less.'
},
{
  id: 'NET-007',
  name: 'Management plane not exposed to the Internet',
  description: 'No interface facing the Internet may accept SSH/HTTP/HTTPS administration.',
  category: 'Management Exposure',
  severity: 'CRITICAL',
  operator: 'custom',
  frameworks: { CIS: '12.6', NIST: 'PR.AC-5', 'PCI DSS': '1.3.1', 'Custom Policy': 'NP-02' },
  remediationHint: 'Remove management services from Internet-facing interfaces.'
},
{
  id: 'NET-008',
  name: 'Centralized logging enabled',
  description: 'Devices must forward events to a central syslog collector.',
  category: 'Logging & Monitoring',
  severity: 'HIGH',
  field: 'logging.enabled',
  operator: 'equals',
  expected: true,
  frameworks: { CIS: '8.2', NIST: 'DE.AE-3', 'ISO 27001': 'A.8.15', 'PCI DSS': '10.2.1' },
  remediationHint: 'Enable logging and point it at the SIEM collector.'
},
{
  id: 'NET-009',
  name: 'At least one syslog destination configured',
  description: 'A logging destination must be defined for retention and correlation.',
  category: 'Logging & Monitoring',
  severity: 'MEDIUM',
  field: 'logging.syslogServers',
  operator: 'nonEmpty',
  frameworks: { CIS: '8.9', NIST: 'DE.AE-3', 'PCI DSS': '10.3.3' },
  remediationHint: 'Configure the corporate syslog server as a logging host.'
},
{
  id: 'NET-010',
  name: 'NTP time synchronization enabled',
  description: 'Accurate timestamps are required for audit trail integrity.',
  category: 'Logging & Monitoring',
  severity: 'MEDIUM',
  field: 'ntp.enabled',
  operator: 'equals',
  expected: true,
  frameworks: { CIS: '8.4', NIST: 'PR.PT-1', 'ISO 27001': 'A.8.17', 'PCI DSS': '10.6.1' },
  remediationHint: 'Enable NTP against the authorized internal time sources.'
},
{
  id: 'NET-011',
  name: 'SNMPv3 in use',
  description: 'SNMP v1/v2c has no encryption or strong authentication.',
  category: 'Insecure Services',
  severity: 'HIGH',
  field: 'snmp.version',
  operator: 'custom',
  frameworks: { CIS: '4.8', NIST: 'PR.DS-2', 'ISO 27001': 'A.8.24' },
  remediationHint: 'Migrate monitoring to SNMPv3 with authPriv and remove v1/v2c access.'
},
{
  id: 'NET-012',
  name: 'No default SNMP community strings',
  description: 'Default community strings such as public/private must not be used.',
  category: 'Insecure Services',
  severity: 'HIGH',
  field: 'snmp.insecureCommunity',
  operator: 'equals',
  expected: false,
  frameworks: { CIS: '4.7', NIST: 'PR.AC-1', 'PCI DSS': '2.2.2' },
  remediationHint: 'Remove default community strings and use SNMPv3 credentials.'
},
{
  id: 'NET-013',
  name: 'DNS resolvers configured',
  description: 'Devices must resolve names through authorized internal resolvers.',
  category: 'Baseline Services',
  severity: 'LOW',
  field: 'dns.servers',
  operator: 'nonEmpty',
  frameworks: { CIS: '4.1', 'Custom Policy': 'NP-08' },
  remediationHint: 'Configure the approved internal DNS servers.'
},
{
  id: 'NET-014',
  name: 'Explicit deny at end of every ACL / policy set',
  description: 'Policy sets must terminate in an explicit deny.',
  category: 'Access Control',
  severity: 'MEDIUM',
  operator: 'custom',
  frameworks: { CIS: '4.4', NIST: 'PR.AC-5', 'ISO 27001': 'A.8.20', 'PCI DSS': '1.2.1' },
  remediationHint: 'Append an explicit deny-all rule with logging to each policy set.'
},
{
  id: 'NET-015',
  name: 'No overly broad permit rules',
  description: 'any → any allow rules with any service defeat segmentation.',
  category: 'Access Control',
  severity: 'CRITICAL',
  operator: 'custom',
  frameworks: { CIS: '4.4', NIST: 'PR.AC-5', 'ISO 27001': 'A.8.22', 'PCI DSS': '1.2.1' },
  remediationHint: 'Replace broad permits with least-privilege rules scoped by zone, address and service.'
},
{
  id: 'NET-016',
  name: 'No Internet-sourced permit into Database zone',
  description: 'Data stores must never be directly reachable from untrusted networks.',
  category: 'Internet Exposure',
  severity: 'CRITICAL',
  operator: 'custom',
  frameworks: { CIS: '12.2', NIST: 'PR.AC-5', 'ISO 27001': 'A.8.22', 'PCI DSS': '1.3.2' },
  remediationHint: 'Remove the permit and restrict database access to application subnets.'
},
{
  id: 'NET-017',
  name: 'Database zone segmented from DMZ',
  description: 'The DMZ must not have direct database access.',
  category: 'Segmentation',
  severity: 'HIGH',
  operator: 'custom',
  frameworks: { CIS: '12.2', NIST: 'PR.PT-4', 'PCI DSS': '1.3.1', 'Custom Policy': 'NP-01' },
  remediationHint: 'Route DMZ traffic through the application tier instead of the database tier.'
},
{
  id: 'NET-018',
  name: 'Insecure services not permitted by policy',
  description: 'Telnet, FTP and plain HTTP must not be permitted across zones.',
  category: 'Insecure Services',
  severity: 'HIGH',
  operator: 'custom',
  frameworks: { CIS: '4.8', NIST: 'PR.DS-2', 'PCI DSS': '2.2.4' },
  remediationHint: 'Remove policy entries permitting telnet/FTP/HTTP between zones.'
},
{
  id: 'NET-019',
  name: 'Policy logging enabled on permit rules',
  description: 'Permitted flows must be logged for detection and forensics.',
  category: 'Logging & Monitoring',
  severity: 'MEDIUM',
  operator: 'custom',
  frameworks: { CIS: '8.5', NIST: 'DE.CM-1', 'PCI DSS': '10.2.1' },
  remediationHint: 'Enable session logging on all permit rules.'
},
{
  id: 'NET-020',
  name: 'VPN uses strong encryption',
  description: 'Site-to-site tunnels must use AES-256 class proposals.',
  category: 'VPN',
  severity: 'HIGH',
  operator: 'custom',
  frameworks: { CIS: '3.10', NIST: 'PR.DS-2', 'ISO 27001': 'A.8.24', 'PCI DSS': '4.2.1' },
  remediationHint: 'Set IKE/IPsec proposals to AES-256 with SHA-256 or stronger.'
},
{
  id: 'NET-021',
  name: 'Third-party VPN access is least privilege',
  description: 'Vendor tunnels must not permit any-service access into internal zones.',
  category: 'Third-Party Access',
  severity: 'CRITICAL',
  operator: 'custom',
  frameworks: { CIS: '15.4', NIST: 'ID.SC-4', 'ISO 27001': 'A.5.19', 'Custom Policy': 'NP-05' },
  remediationHint: 'Scope vendor policies to a jump host and named services only.'
},
{
  id: 'NET-022',
  name: 'Centralized authentication (AAA) configured',
  description: 'Administrative authentication must be centralized, not local-only.',
  category: 'Administrative Access',
  severity: 'MEDIUM',
  field: 'aaa.centralized',
  operator: 'equals',
  expected: true,
  frameworks: { CIS: '6.7', NIST: 'PR.AC-1', 'ISO 27001': 'A.5.16', 'PCI DSS': '8.3.1' },
  remediationHint: 'Point device authentication at the central TACACS+/RADIUS service.'
},
{
  id: 'NET-023',
  name: 'Limited number of local privileged accounts',
  description: 'Local break-glass accounts must be kept to a minimum.',
  category: 'Administrative Access',
  severity: 'LOW',
  operator: 'custom',
  frameworks: { CIS: '5.4', NIST: 'PR.AC-4', 'ISO 27001': 'A.5.15' },
  remediationHint: 'Keep at most two local privileged accounts and rotate their credentials.'
},
{
  id: 'NET-024',
  name: 'No unrestricted NAT publication of internal hosts',
  description: 'Destination NAT must not publish internal hosts on all ports.',
  category: 'Internet Exposure',
  severity: 'HIGH',
  operator: 'custom',
  frameworks: { CIS: '12.2', NIST: 'PR.AC-5', 'PCI DSS': '1.3.2' },
  remediationHint: 'Scope destination NAT entries to specific published ports.'
}];


export const RULES_BY_ID: Record<string, ComplianceRule> = COMPLIANCE_RULES.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<string, ComplianceRule>
);