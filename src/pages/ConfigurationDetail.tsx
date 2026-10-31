import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { redactSecrets } from '../engine/redact';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  Table,
  Td,
  Th,
  cn } from
'../components/ui/primitives';

const TABS = ['Normalized model', 'Policy rules', 'Raw configuration'] as const;

export function ConfigurationDetailPage() {
  const { id } = useParams();
  const { db, orgId, runScan, analysis } = useNexus();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Normalized model');
  const config = db.configurations.find((c) => c.id === id && c.orgId === orgId);

  if (!config) {
    return <EmptyState title="Configuration not found" description="It may have been replaced by a newer version." />;
  }

  const n = config.normalized;
  const redacted = redactSecrets(config.raw);
  const results = analysis.ruleResults.filter((r) => r.deviceId === config.deviceId);

  return (
    <>
      <PageHeader
        title={`${config.deviceName} · v${config.version}`}
        description={`${config.vendor} · ${config.fileName} · uploaded ${format(new Date(config.uploadedAt), 'PPp')}`}
        actions={
        <>
            <Link
            to={`/devices/${config.deviceId}`}
            className="inline-flex items-center rounded-md border border-hairlineStrong bg-elevated px-3 py-2 text-sm text-ink hover:bg-hairline">
            
              Device
            </Link>
            <Button variant="primary" onClick={() => runScan(`Audit · ${config.deviceName} v${config.version}`)}>
              Run Security Audit
            </Button>
          </>
        } />
      

      <div className="mb-4 flex flex-wrap gap-1 border-b border-hairline">
        {TABS.map((t) =>
        <button
          key={t}
          onClick={() => setTab(t)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-150 ease-out',
            tab === t ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
          )}>
          
            {t}
          </button>
        )}
      </div>

      {tab === 'Normalized model' &&
      <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Device & services">
            <KeyValue label="Hostname" value={n.hostname} mono />
            <KeyValue label="Vendor" value={n.vendor} />
            <KeyValue label="Zones" value={n.zones.join(', ') || 'none detected'} />
            <KeyValue label="VLANs" value={n.vlans.map((v) => `${v.id} ${v.name}`).join(', ') || 'none'} />
            <KeyValue
            label="Management"
            value={
            <span className="space-x-2">
                  <Badge tone={n.management.ssh ? 'PASS' : 'MEDIUM'}>SSH {n.management.ssh ? 'on' : 'off'}</Badge>
                  <Badge tone={n.management.telnet ? 'FAIL' : 'PASS'}>
                    Telnet {n.management.telnet ? 'ON' : 'off'}
                  </Badge>
                  <Badge tone={n.management.http ? 'FAIL' : 'PASS'}>HTTP {n.management.http ? 'ON' : 'off'}</Badge>
                  <Badge tone="neutral">idle {n.management.idleTimeoutMinutes || '—'}m</Badge>
                </span>
            } />
          
            <KeyValue
            label="Source restriction"
            value={n.management.mgmtAccessRestricted ? 'restricted to trusted hosts' : 'unrestricted'} />
          
            <KeyValue
            label="Logging"
            value={`${n.logging.enabled ? 'enabled' : 'disabled'} · ${n.logging.syslogServers.join(', ') || 'no collector'}`} />
          
            <KeyValue label="SNMP" value={n.snmp.enabled ? `v${n.snmp.version}` : 'disabled'} />
            <KeyValue label="NTP" value={n.ntp.servers.join(', ') || 'not configured'} />
            <KeyValue label="DNS" value={n.dns.servers.join(', ') || 'not configured'} />
            <KeyValue
            label="AAA"
            value={`${n.aaa.centralized ? 'centralized' : 'local only'} · ${n.aaa.localUsers.
            map((u) => `${u.name} (${u.privilege})`).
            join(', ') || 'no local users'}`} />
          
            <KeyValue label="Secrets" value={`${n.secretsRedacted} value(s) detected and redacted`} />
          </Panel>

          <div className="space-y-4">
            <Panel title="Interfaces" bodyClassName="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Interface</Th>
                    <Th>Address</Th>
                    <Th>Zone</Th>
                    <Th>Mgmt services</Th>
                  </tr>
                </thead>
                <tbody>
                  {n.interfaces.map((i) =>
                <tr key={i.name}>
                      <Td className="font-mono text-xs">{i.name}</Td>
                      <Td className="font-mono text-xs text-muted">{i.ipAddress || '—'}</Td>
                      <Td>{i.zone}</Td>
                      <Td className="text-xs text-muted">{i.allowedManagement.join(', ') || '—'}</Td>
                    </tr>
                )}
                </tbody>
              </Table>
            </Panel>

            <Panel title="Routes, NAT & VPN" bodyClassName="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Detail</Th>
                  </tr>
                </thead>
                <tbody>
                  {n.routes.map((r, i) =>
                <tr key={`r-${i}`}>
                      <Td className="text-muted">{r.type === 'static' ? 'Static route' : `Dynamic (${r.protocol})`}</Td>
                      <Td className="font-mono text-xs">
                        {r.destination} → {r.nextHop}
                      </Td>
                    </tr>
                )}
                  {n.natRules.map((r) =>
                <tr key={r.id}>
                      <Td className="text-muted">NAT ({r.type})</Td>
                      <Td className="font-mono text-xs">{r.raw}</Td>
                    </tr>
                )}
                  {n.vpnConnections.map((v) =>
                <tr key={v.id}>
                      <Td className="text-muted">VPN ({v.type})</Td>
                      <Td className="font-mono text-xs">
                        {v.name} → {v.peer} · {v.encryption}
                      </Td>
                    </tr>
                )}
                </tbody>
              </Table>
            </Panel>
          </div>
        </div>
      }

      {tab === 'Policy rules' &&
      <Panel
        title={`${n.firewallRules.length} normalized policy rules`}
        subtitle="Evaluated first-match, in order, by the reachability engine"
        bodyClassName="p-0">
        
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Name</Th>
                <Th>Source zone</Th>
                <Th>Destination zone</Th>
                <Th>Service</Th>
                <Th>Action</Th>
                <Th>Log</Th>
              </tr>
            </thead>
            <tbody>
              {n.firewallRules.map((r) =>
            <tr key={r.id}>
                  <Td className="tabular-nums text-muted">{r.seq}</Td>
                  <Td className="font-mono text-xs">{r.name}</Td>
                  <Td>{r.srcZone}</Td>
                  <Td>{r.dstZone}</Td>
                  <Td className="font-mono text-xs text-muted">
                    {r.protocol.toUpperCase()}/{r.ports}
                  </Td>
                  <Td>
                    <Badge tone={r.action === 'ALLOW' ? 'MEDIUM' : 'PASS'}>{r.action}</Badge>
                  </Td>
                  <Td className="text-xs text-muted">{r.log ? 'yes' : 'no'}</Td>
                </tr>
            )}
            </tbody>
          </Table>
        </Panel>
      }

      {tab === 'Raw configuration' &&
      <Panel
        title="Raw configuration"
        subtitle={`${redacted.redactedCount} secret value(s) redacted before display: ${
        redacted.categories.join(', ') || 'none found'}`
        }>
        
          <pre className="max-h-[32rem] overflow-auto rounded-md border border-hairline bg-canvas p-3 font-mono text-2xs leading-relaxed text-muted">
            {redacted.text}
          </pre>
        </Panel>
      }

      <Panel className="mt-4" title="Compliance outcome for this device" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Rule</Th>
              <Th>Expected</Th>
              <Th>Actual</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) =>
            <tr key={r.ruleId}>
                <Td>
                  <Link to={`/compliance/${r.ruleId}`} className="text-ink hover:text-accent">
                    {r.ruleId}
                  </Link>
                </Td>
                <Td className="font-mono text-xs text-muted">{r.expected}</Td>
                <Td className="font-mono text-xs text-muted">{r.actual}</Td>
                <Td>
                  <Badge tone={r.status}>{r.status}</Badge>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </>);

}