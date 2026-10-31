import React from 'react';
import { format } from 'date-fns';
import { DatabaseIcon, Trash2Icon } from 'lucide-react';
import { AI_LIVE, AI_MODEL } from '../engine/ai';
import { ROLE_PERMISSIONS } from '../store/db';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  KeyValue,
  PageHeader,
  Panel,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

const TABLES = [
'users',
'organizations',
'devices',
'vendors',
'configurations',
'configuration_snapshots',
'compliance_frameworks',
'compliance_rules',
'network_intents',
'network_connections',
'assets',
'findings',
'dependencies',
'risk_scores',
'audit_runs',
'alerts',
'remediations',
'audit_logs'];


export function SettingsPage() {
  const { user, orgName, db, orgId, loadDemoEnvironment, resetEnvironment, hasData } = useNexus();
  const logs = db.audit_logs.filter((l) => l.orgId === orgId).slice(0, 40);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account, access control, data model and demo environment controls." />
      

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Account">
          <KeyValue label="Name" value={user?.name ?? '—'} />
          <KeyValue label="Email" value={user?.email ?? '—'} />
          <KeyValue label="Role" value={<Badge tone="accent">{user?.role}</Badge>} />
          <KeyValue label="Organization" value={orgName} />
          <KeyValue label="Tenant id" value={orgId} mono />
          <KeyValue
            label="Credential storage"
            value="Salted digest only — plaintext passwords are never stored or transmitted." />
          
        </Panel>

        <Panel title="Role-based access control" className="xl:col-span-2" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Role</Th>
                <Th>Permissions enforced on every action</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) =>
              <tr key={role}>
                  <Td className="font-medium">
                    {role}
                    {user?.role === role && <Badge className="ml-2" tone="accent">you</Badge>}
                  </Td>
                  <Td className="font-mono text-xs text-muted">{perms.join('  ·  ')}</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Demo environment">
          <p className="text-sm text-muted">
            Load a fully populated multi-vendor estate — Cisco, Fortinet, Juniper and Palo Alto
            configurations, assets, intent rules and third-party dependencies.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<DatabaseIcon className="h-4 w-4" />} onClick={loadDemoEnvironment}>
              {hasData ? 'Reload Demo Environment' : 'Load Demo Environment'}
            </Button>
            <Button variant="danger" icon={<Trash2Icon className="h-4 w-4" />} onClick={resetEnvironment}>
              Clear All Data
            </Button>
          </div>
        </Panel>

        <Panel title="AI layer">
          <KeyValue label="Model" value={AI_MODEL} />
          <KeyValue label="Live LLM API" value={AI_LIVE ? 'connected' : 'not connected — template engine active'} />
          <KeyValue
            label="Scope"
            value="Explanation and remediation only. Compliance, reachability, drift and risk are deterministic." />
          
          <KeyValue
            label="Secret handling"
            value="Detection → redaction → structured payload. Credentials never reach the AI layer." />
          
        </Panel>

        <Panel title="Data model">
          <p className="text-sm text-muted">
            Entities are persisted in a PostgreSQL-compatible shape, one table per entity, every row
            scoped by organization for tenant isolation.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TABLES.map((t) =>
            <span
              key={t}
              className="rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-2xs text-muted">
              
                {t}
              </span>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Audit log" subtitle="Every privileged action is recorded" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) =>
            <tr key={l.id}>
                <Td className="text-xs text-muted">{format(new Date(l.at), 'PPp')}</Td>
                <Td className="text-xs">{l.actor}</Td>
                <Td>{l.action}</Td>
                <Td className="text-xs text-muted">{l.target}</Td>
              </tr>
            )}
            {!logs.length &&
            <tr>
                <Td className="py-6 text-center text-muted">No activity recorded yet.</Td>
              </tr>
            }
          </tbody>
        </Table>
      </Panel>
    </>);

}