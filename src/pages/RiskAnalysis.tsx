import React from 'react';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { SEVERITY_WEIGHT, riskBandFor } from '../engine/risk';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  EmptyState,
  MeterRow,
  PageHeader,
  Panel,
  ScoreDial,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function RiskAnalysisPage() {
  const { analysis, findings, db, orgId, hasData } = useNexus();

  if (!hasData) {
    return (
      <>
        <PageHeader title="Risk Analysis" description="Deterministic scoring across every engine." />
        <EmptyState title="Nothing to score" description="Load the demo environment or upload configurations." />
      </>);

  }

  const open = findings.filter((f) => f.status !== 'Resolved');
  const band = riskBandFor(analysis.risk.overall);
  const byCategory = Array.from(new Set(open.map((f) => f.category))).map((category) => ({
    category,
    weight: open.
    filter((f) => f.category === category).
    reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0),
    count: open.filter((f) => f.category === category).length
  }));

  const runs = db.audit_runs.filter((r) => r.orgId === orgId).slice(0, 12).reverse();
  const trend = runs.map((r) => ({
    at: format(new Date(r.startedAt), 'MMM d HH:mm'),
    score: r.scoreAfter,
    critical: r.critical
  }));

  return (
    <>
      <PageHeader
        title="Risk Analysis"
        description="Every score below is computed by deterministic rules — the AI layer explains them but never produces them." />
      

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Composite score" actions={<Badge tone={band.label}>{band.label}</Badge>}>
          <div className="flex flex-col items-center gap-5">
            <ScoreDial score={analysis.risk.overall} label="Overall security score" />
            <div className="w-full space-y-3">
              <MeterRow label="Compliance risk" value={analysis.risk.compliance} />
              <MeterRow label="Network exposure" value={analysis.risk.exposure} />
              <MeterRow label="Third-party risk" value={analysis.risk.thirdParty} />
              <MeterRow label="Drift risk" value={analysis.risk.drift} />
            </div>
            <p className="text-2xs text-faint">
              Recalculated {format(new Date(analysis.risk.calculatedAt), 'PPp')}
            </p>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Risk pressure by source" subtitle="Sum of severity weights per finding category">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="#1e242f" vertical={false} />
                  <XAxis dataKey="category" stroke="#5d6779" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5d6779" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#12161f',
                      border: '1px solid #2a323f',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#e8ecf3'
                    }} />
                  
                  <Bar dataKey="weight" fill="#3d7dff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Score history" subtitle="Recorded per audit run">
            {trend.length ?
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#1e242f" vertical={false} />
                    <XAxis dataKey="at" stroke="#5d6779" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="#5d6779" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                    contentStyle={{
                      background: '#12161f',
                      border: '1px solid #2a323f',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#e8ecf3'
                    }} />
                  
                    <Line type="monotone" dataKey="score" stroke="#38c793" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div> :

            <p className="text-sm text-muted">Run a network scan to record the first data point.</p>
            }
          </Panel>
        </div>
      </div>

      <Panel className="mt-4" title="Audit runs" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Started</Th>
              <Th>Trigger</Th>
              <Th className="text-right">Devices</Th>
              <Th className="text-right">Critical</Th>
              <Th className="text-right">High</Th>
              <Th className="text-right">Drift</Th>
              <Th className="text-right">Third-party</Th>
              <Th className="text-right">Score</Th>
            </tr>
          </thead>
          <tbody>
            {db.audit_runs.
            filter((r) => r.orgId === orgId).
            map((r) =>
            <tr key={r.id}>
                  <Td className="text-xs text-muted">{format(new Date(r.startedAt), 'PPp')}</Td>
                  <Td className="text-muted">{r.trigger}</Td>
                  <Td className="text-right tabular-nums">{r.devices}</Td>
                  <Td className="text-right tabular-nums text-critical">{r.critical}</Td>
                  <Td className="text-right tabular-nums text-high">{r.high}</Td>
                  <Td className="text-right tabular-nums">{r.driftEvents}</Td>
                  <Td className="text-right tabular-nums">{r.thirdPartyRisks}</Td>
                  <Td className="text-right tabular-nums">
                    {r.scoreBefore} → {r.scoreAfter}
                  </Td>
                </tr>
            )}
            {!db.audit_runs.filter((r) => r.orgId === orgId).length &&
            <tr>
                <Td className="py-6 text-center text-muted">No audit runs recorded yet.</Td>
              </tr>
            }
          </tbody>
        </Table>
      </Panel>
    </>);

}