import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangleIcon, RotateCcwIcon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  StatTile,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function DriftPage() {
  const { analysis, db, orgId, simulateDrift, revertDrift, hasData, findings } = useNexus();
  const snapshots = db.configuration_snapshots.
  filter((s) => s.orgId === orgId).
  sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const events = analysis.driftEvents;
  const driftFindings = findings.filter((f) => f.category === 'Drift');

  return (
    <>
      <PageHeader
        title="Drift"
        description="Configuration snapshots are compared field by field and policy by policy. Any change that contradicts intent becomes a finding."
        actions={
        <>
            <Button
            variant="danger"
            icon={<AlertTriangleIcon className="h-4 w-4" />}
            onClick={() => simulateDrift()}
            disabled={!hasData}>
            
              Simulate Security Drift
            </Button>
            <Button icon={<RotateCcwIcon className="h-4 w-4" />} onClick={revertDrift} disabled={!events.length}>
              Restore Baseline
            </Button>
          </>
        } />
      

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Snapshots stored" value={snapshots.length} />
        <StatTile label="Drift events" value={events.length} tone={events.length ? 'medium' : 'neutral'} />
        <StatTile
          label="Critical drift"
          value={events.filter((e) => e.severity === 'CRITICAL').length}
          tone="critical" />
        
        <StatTile label="Drift risk" value={`${analysis.risk.drift}/100`} tone="high" />
      </div>

      {!events.length ?
      <EmptyState
        title="No drift detected"
        description={
        hasData ?
        'Every stored snapshot matches its predecessor. Use Simulate Security Drift to inject an unreviewed emergency policy on Fortinet-FW-01 and watch the pipeline react.' :
        'Load the demo environment first, then simulate drift.'
        }
        actions={
        hasData ?
        <Button variant="danger" onClick={() => simulateDrift()}>
                Simulate Security Drift
              </Button> :
        undefined
        } /> :


      <div className="space-y-4">
          {events.
        filter((e) => e.severity === 'CRITICAL').
        map((e) =>
        <Panel
          key={e.id}
          title={`Critical security drift · ${e.deviceName}`}
          subtitle={`${e.fromSnapshot} → ${e.toSnapshot} · detected ${format(new Date(e.detectedAt), 'PPp')}`}
          actions={<Badge tone="CRITICAL">CRITICAL</Badge>}>
          
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border border-hairline bg-elevated px-3 py-2">
                    <p className="text-2xs uppercase tracking-wider text-faint">Previous</p>
                    <p className="mt-1 font-mono text-xs text-ink">{e.previous}</p>
                  </div>
                  <div className="rounded-md border border-critical/40 bg-critical/10 px-3 py-2">
                    <p className="text-2xs uppercase tracking-wider text-critical/80">Current</p>
                    <p className="mt-1 font-mono text-xs text-critical">{e.current}</p>
                  </div>
                  <div className="rounded-md border border-hairline bg-elevated px-3 py-2">
                    <p className="text-2xs uppercase tracking-wider text-faint">Intent</p>
                    <p className="mt-1 font-mono text-xs text-ink">{e.intent ?? 'reviewed baseline'}</p>
                  </div>
                  <div className="rounded-md border border-hairline bg-elevated px-3 py-2">
                    <p className="text-2xs uppercase tracking-wider text-faint">Changed field</p>
                    <p className="mt-1 font-mono text-xs text-ink">{e.field}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">
                  This change triggered intent, segmentation, reachability and compliance re-evaluation.
                </p>
                {driftFindings.some((f) => f.id === `f-drift-${e.id}`) &&
          <Link
            to={`/findings/f-drift-${e.id}`}
            className="mt-2 inline-block text-xs text-accent hover:underline">
            
                    Investigate finding
                  </Link>
          }
              </Panel>
        )}

          <Panel title="All drift events" bodyClassName="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Device</Th>
                  <Th>Field</Th>
                  <Th>Previous</Th>
                  <Th>Current</Th>
                  <Th>Detected</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) =>
              <tr key={e.id}>
                    <Td>
                      <Badge tone={e.severity}>{e.severity}</Badge>
                    </Td>
                    <Td>
                      <Link to={`/devices/${e.deviceId}`} className="text-ink hover:text-accent">
                        {e.deviceName}
                      </Link>
                    </Td>
                    <Td className="text-muted">{e.field}</Td>
                    <Td className="font-mono text-xs text-muted">{e.previous}</Td>
                    <Td className="font-mono text-xs text-ink">{e.current}</Td>
                    <Td className="text-xs text-muted">{format(new Date(e.detectedAt), 'PPp')}</Td>
                  </tr>
              )}
              </tbody>
            </Table>
          </Panel>
        </div>
      }

      <Panel className="mt-4" title="Configuration snapshots" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Snapshot</Th>
              <Th>Device</Th>
              <Th className="text-right">Policy rules</Th>
              <Th>Telnet</Th>
              <Th>Logging</Th>
              <Th>Taken</Th>
            </tr>
          </thead>
          <tbody>
            {snapshots.slice(0, 40).map((s) =>
            <tr key={s.id}>
                <Td>{s.label}</Td>
                <Td className="text-muted">{s.deviceName}</Td>
                <Td className="text-right tabular-nums">{s.normalized.firewallRules.length}</Td>
                <Td>
                  <Badge tone={s.normalized.management.telnet ? 'FAIL' : 'PASS'}>
                    {s.normalized.management.telnet ? 'ON' : 'off'}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={s.normalized.logging.enabled ? 'PASS' : 'FAIL'}>
                    {s.normalized.logging.enabled ? 'on' : 'off'}
                  </Badge>
                </Td>
                <Td className="text-xs text-muted">{format(new Date(s.takenAt), 'PPp')}</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </>);

}