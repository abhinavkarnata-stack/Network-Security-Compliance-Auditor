import type {
  Alert,
  Asset,
  AuditLogEntry,
  AuditRun,
  Configuration,
  ConfigurationSnapshot,
  DependencyEdge,
  Device,
  NetworkIntent,
  Organization,
  Report,
  RiskScores,
  Role,
  ThirdPartyVendor,
  TopologyEdgeDef,
  User } from
'../types/nexus';

/**
 * Local persistence layer. The schema mirrors a PostgreSQL model one table per
 * array, every row carrying orgId for tenant isolation, so it can be swapped for
 * a real database behind the same accessors without touching the UI.
 */
export interface NexusDB {
  organizations: Organization[];
  users: User[];
  devices: Device[];
  vendors: ThirdPartyVendor[];
  configurations: Configuration[];
  configuration_snapshots: ConfigurationSnapshot[];
  network_intents: NetworkIntent[];
  topology_edges: (TopologyEdgeDef & {orgId: string;})[];
  assets: Asset[];
  dependencies: (DependencyEdge & {orgId: string;})[];
  finding_overrides: Record<
    string,
    {status?: 'Open' | 'Investigating' | 'Resolved';aiExplanation?: unknown;remediation?: unknown;}>;

  risk_scores: (RiskScores & {orgId: string;id: string;})[];
  audit_runs: AuditRun[];
  alerts: Alert[];
  audit_logs: AuditLogEntry[];
  reports: Report[];
  session: {userId: string;} | null;
}

const STORAGE_KEY = 'nexus.db.v1';

export const DEFAULT_ORG_ID = 'org-nexus-demo';

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Demo-grade password digest. Passwords are never stored or transmitted in
 * plaintext; a real deployment replaces this with bcrypt/argon2 server-side.
 */
export function hashPassword(password: string, salt = 'nexus-static-salt'): string {
  const input = `${salt}:${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = h1 * 0x01000193 >>> 0;
    h2 = h2 + c * (i + 7) >>> 0;
    h2 = (h2 << 5 ^ h2 >>> 3) >>> 0;
  }
  return `fnv1a$${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function verifyPassword(password: string, digest: string): boolean {
  return hashPassword(password) === digest;
}

export const SEED_USERS: {email: string;name: string;role: Role;password: string;}[] = [
{ email: 'demo@nexus.io', name: 'Demo Analyst', role: 'Administrator', password: 'nexus-demo' },
{ email: 'analyst@nexus.io', name: 'Priya Raman', role: 'Security Analyst', password: 'nexus-demo' },
{ email: 'auditor@nexus.io', name: 'Tom Alvarez', role: 'Auditor', password: 'nexus-demo' }];


export function emptyDB(): NexusDB {
  const org: Organization = { id: DEFAULT_ORG_ID, name: 'Northwind Financial' };
  return {
    organizations: [org],
    users: SEED_USERS.map((u, i) => ({
      id: `user-${i + 1}`,
      orgId: org.id,
      email: u.email,
      name: u.name,
      role: u.role,
      passwordDigest: hashPassword(u.password),
      createdAt: new Date().toISOString()
    })),
    devices: [],
    vendors: [],
    configurations: [],
    configuration_snapshots: [],
    network_intents: [],
    topology_edges: [],
    assets: [],
    dependencies: [],
    finding_overrides: {},
    risk_scores: [],
    audit_runs: [],
    alerts: [],
    audit_logs: [],
    reports: [],
    session: null
  };
}

export function loadDB(): NexusDB {
  if (typeof window === 'undefined') return emptyDB();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as NexusDB;
    return { ...emptyDB(), ...parsed };
  } catch {
    return emptyDB();
  }
}

export function saveDB(db: NexusDB): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {

    /* storage full or unavailable — state stays in memory */}
}

export function resetDB(): NexusDB {
  const fresh = emptyDB();
  saveDB(fresh);
  return fresh;
}

/** Tenant-scoped selector used everywhere the UI reads a table. */
export function scoped<T extends {orgId: string;}>(rows: T[], orgId: string): T[] {
  return rows.filter((r) => r.orgId === orgId);
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Administrator: [
  'device:create',
  'config:upload',
  'audit:run',
  'intent:write',
  'drift:simulate',
  'report:generate',
  'ai:query',
  'settings:write'],

  'Security Analyst': [
  'device:create',
  'config:upload',
  'audit:run',
  'intent:write',
  'drift:simulate',
  'report:generate',
  'ai:query'],

  Auditor: ['report:generate', 'ai:query']
};

export function can(role: Role | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}