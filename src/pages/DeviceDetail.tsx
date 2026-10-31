import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { RULES_BY_ID } from '../data/complianceRules';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function DeviceDetailPage() {
  const { id } = useParams();
  const { analysis, db, orgId, findings } = useNexus();
  const device = analysis.deviceUpdates.find((d) => d.id === id);

  if (!device) {
    return <EmptyState title="Device not found" description="This device is not part of your organization." />;
  }

  const configs = db.configurations.
  filter((c) => c.orgId === orgId && c.deviceId === device.id).
  sort((a, b) => b.version - a.version);
  const latest = configs[0];
  const snapshots = db.configuration_snapshots.
  filter((s) => s.orgId === orgId && s.deviceId === device.id).
  sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const results = analysis.ruleResults.filter((r) => r.deviceId === device.id);
  const deviceFindings = findings.filter((f) => f.deviceId === device.id);

  return (
    <>
      <PageHeader
        title={device.name}
        description={`${device.vendor} ${device.type} · ${device.ip} · ${device.environment}`}
        actions={
        <>
            <Badge tone={device.risk}>{device.risk} risk</Badge>
            {latest &&
          <Link
            to={`/configurations/${latest.id}`}
            className="inline-flex items-center rounded-md border border-hairlineStrong bg-elevated px-3 py-2 text-sm text-ink hover:bg-hairline">
            
                View normalized model
              </Link>
          }
          </>
        } />
      

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Posture" className="lg:col-span-1">
          <KeyValue label="Compliance" value={`${device.compliance}%`} />
          <KeyValue label="Risk" value={device.risk} />
          <KeyValue label="Status" value={device.status} />
          <KeyValue
            label="Last scan"
            value={device.lastScan ? format(new Date(device.lastScan), 'PPpp') : 'never scanned'} />
          
          <KeyValue label="Configurations stored" value={configs.length} />
          <KeyValue label="Snapshots" value={snapshots.length} />
        </Panel>

        <Panel title="Normalized security model" className="lg:col-span-2">
          {latest ?
          <div className="grid gap-x-8 sm:grid-cols-2">
              <div>
                <KeyValue label="Hostname" value={latest.normalized.hostname} mono />
                <KeyValue label="Zones" value={latest.normalized.zones.join(', ') || 'none'} />
                <KeyValue label="Interfaces" value={latest.normalized.interfaces.length} />
                <KeyValue label="Routes" value={latest.normalized.routes.length} />
                <KeyValue label="Policy rules" value={latest.normalized.firewallRules.length} />
                <KeyValue label="NAT rules" value={latest.normalized.natRules.length} />
              </div>
              <div>
                <KeyValue
                label="Management"
                value={`SSH ${latest.normalized.management.ssh ? 'on' : 'off'} · Telnet ${
                latest.normalized.management.telnet ? 'ON' : 'off'} · HTTPS ${
                latest.normalized.management.https ? 'on' : 'off'}`} />
              
                <KeyValue
                label="Logging"
                value={`${latest.normalized.logging.enabled ? 'enabled' : 'disabled'} · ${
                latest.normalized.logging.syslogServers.join(', ') || 'no collector'}`
                } />
              
                <KeyValue
                label="SNMP"
                value={latest.normalized.snmp.enabled ? `v${latest.normalized.snmp.version}` : 'disabled'} />
              
                <KeyValue
                label="NTP"
                value={latest.normalized.ntp.servers.join(', ') || 'not configured'} />
              
                <KeyValue label="VPN tunnels" value={latest.normalized.vpnConnections.length} />
                <KeyValue
                label="Secrets redacted"
                value={`${latest.normalized.secretsRedacted} value(s) never leave the parser`} />
              
              </div>
            </div> :

          <p className="text-sm text-muted">
              No configuration has been uploaded for this device yet, so no audit can run against it.
            </p>
          }
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Compliance results" subtitle={`${results.filter((r) => r.status === 'FAIL').length} failing of ${results.length} rules`} bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Rule</Th>
                <Th>Severity</Th>
                <Th>Result</Th>
                <Th>Actual</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) =>
              <tr key={r.ruleId}>
                  <Td>
                    <Link to={`/compliance/${r.ruleId}`} className="text-ink hover:text-accent">
                      {r.ruleId} · {RULES_BY_ID[r.ruleId]?.name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={RULES_BY_ID[r.ruleId]?.severity ?? 'LOW'}>
                      {RULES_BY_ID[r.ruleId]?.severity}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={r.status}>{r.status}</Badge>
                  </Td>
                  <Td className="font-mono text-xs text-muted">{r.actual}</Td>
                </tr>
              )}
              {!results.length &&
              <tr>
                  <Td className="py-6 text-center text-muted">No rule results — upload a configuration.</Td>
                </tr>
              }
            </tbody>
          </Table>
        </Panel>

        <div className="space-y-4">
          <Panel title="Configuration history" bodyClassName="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Version</Th>
                  <Th>File</Th>
                  <Th>Uploaded</Th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) =>
                <tr key={c.id}>
                    <Td>
                      <Link to={`/configurations/${c.id}`} className="text-ink hover:text-accent">
                        v{c.version}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs text-muted">{c.fileName}</Td>
                    <Td className="text-xs text-muted">{format(new Date(c.uploadedAt), 'PPp')}</Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Findings on this device" bodyClassName="p-0">
            <ul className="divide-y divide-hairline/60">
              {deviceFindings.map((f) =>
              <li key={f.id}>
                  <Link
                  to={`/findings/${f.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03]">
                  
                    <Badge tone={f.severity}>{f.severity}</Badge>
                    <span className="min-w-0 text-sm text-ink">{f.title}</span>
                  </Link>
                </li>
              )}
              {!deviceFindings.length &&
              <li className="px-4 py-6 text-sm text-muted">No device-specific findings.</li>
              }
            </ul>
          </Panel>
        </div>
      </div>
    </>);

}