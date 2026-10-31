import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { DatabaseIcon, PlusIcon, ServerIcon, UploadIcon } from 'lucide-react';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { UploadConfigModal } from '../components/UploadConfigModal';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  MeterRow,
  PageHeader,
  Panel,
  ScoreDial,
  StatTile } from
'../components/ui/primitives';

const CHART_AXIS = { stroke: '#5d6779', fontSize: 11 };
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ff4d5e',
  HIGH: '#ff9147',
  MEDIUM: '#e8c74a',
  LOW: '#4fb3ff'
};

function chartTooltip() {
  return {
    contentStyle: {
      background: '#12161f',
      border: '1px solid #2a323f',
      borderRadius: 8,
      fontSize: 12,
      color: '#e8ecf3'
    },
    labelStyle: { color: '#8b95a7' }
  };
}

export function DashboardPage() {
  const { hasData, loadDemoEnvironment, analysis, findings, db, orgId } = useNexus();
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();

  const devices = analysis.deviceUpdates;
  const open = findings.filter((f) => f.status !== 'Resolved');

  const trend = useMemo(() => {
    const rows = db.risk_scores.filter((r) => r.orgId === orgId).slice(-12);
    return rows.map((r) => ({
      at: format(new Date(r.calculatedAt), 'MMM d'),
      score: r.overall,
      compliance: 100 - r.compliance
    }));
  }, [db.risk_scores, orgId]);

  const severityDistribution = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({
    severity: s,
    count: open.filter((f) => f.severity === s).length
  }));

  const byVendor = useMemo(() => {
    const vendors = Array.from(new Set(devices.map((d) => d.vendor)));
    return vendors.map((v) => {
      const rows = devices.filter((d) => d.vendor === v);
      return {
        vendor: v,
        compliance: Math.round(rows.reduce((s, d) => s + d.compliance, 0) / Math.max(1, rows.length))
      };
    });
  }, [devices]);

  const coverage = analysis.frameworkCoverage.map((f) => ({
    framework: f.framework,
    score: f.score
  }));

  const thirdParty = analysis.vendorRisks.map((v) => ({
    vendor: v.vendor.name,
    score: v.score,
    systems: v.dependentSystems
  }));

  const driftActivity = useMemo(() => {
    const buckets = new Map<string, number>();
    analysis.driftEvents.forEach((d) => {
      const key = format(new Date(d.detectedAt), 'MMM d');
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    const rows = Array.from(buckets.entries()).map(([at, count]) => ({ at, count }));
    return rows.length ? rows : [{ at: 'No drift', count: 0 }];
  }, [analysis.driftEvents]);

  if (!hasData) {
    return (
      <>
        <PageHeader title="Welcome to NEXUS" description="AI-driven multi-vendor network security compliance auditing." />
        <EmptyState
          icon={<ServerIcon className="h-8 w-8" />}
          title="No network infrastructure has been connected yet"
          description="Connect a device or upload a configuration to begin your first security audit. Nothing is shown until real or demo configuration data exists."
          actions={
          <>
              <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Add Device
              </Button>
              <Button variant="secondary" icon={<UploadIcon className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                Upload Configuration
              </Button>
              <Button variant="primary" icon={<DatabaseIcon className="h-4 w-4" />} onClick={loadDemoEnvironment}>
                Load Demo Environment
              </Button>
            </>
          } />
        
        <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} />
        <UploadConfigModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      </>);

  }

  return (
    <>
      <PageHeader
        title="Network Security Posture"
        description="What the network is configured to do, what the organization intends, and what can actually reach what."
        actions={
        <>
            <Button size="sm" onClick={() => navigate('/reachability')}>
              Analyze Reachability
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate('/findings')}>
              Review Findings
            </Button>
          </>
        } />
      

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Security score" subtitle="Deterministic composite of all engines">
          <div className="flex flex-col items-center gap-5">
            <ScoreDial score={analysis.risk.overall} label="Overall security score" />
            <div className="w-full space-y-3">
              <MeterRow label="Compliance risk" value={analysis.risk.compliance} />
              <MeterRow label="Network exposure" value={analysis.risk.exposure} />
              <MeterRow label="Third-party risk" value={analysis.risk.thirdParty} />
              <MeterRow label="Drift risk" value={analysis.risk.drift} />
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Compliance" value={`${analysis.complianceScore}%`} />
            <StatTile label="Devices" value={devices.length} />
            <StatTile
              label="Critical"
              value={open.filter((f) => f.severity === 'CRITICAL').length}
              tone="critical" />
            
            <StatTile label="High" value={open.filter((f) => f.severity === 'HIGH').length} tone="high" />
            <StatTile label="Drift" value={analysis.driftEvents.length} tone="medium" />
            <StatTile
              label="Intent violations"
              value={analysis.intentEvaluations.filter((e) => !e.compliant).length}
              tone="accent" />
            
          </div>

          <Panel title="Compliance & score trend" subtitle="Recorded at each audit run">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#1e242f" vertical={false} />
                  <XAxis dataKey="at" {...CHART_AXIS} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} {...CHART_AXIS} tickLine={false} axisLine={false} />
                  <Tooltip {...chartTooltip()} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Security score"
                    stroke="#3d7dff"
                    strokeWidth={2}
                    dot={false} />
                  
                  <Line
                    type="monotone"
                    dataKey="compliance"
                    name="Compliance %"
                    stroke="#38c793"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false} />
                  
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Risk distribution" subtitle="Open findings by severity">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityDistribution} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#1e242f" vertical={false} />
                <XAxis dataKey="severity" {...CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis {...CHART_AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...chartTooltip()} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {severityDistribution.map((row) =>
                  <Cell key={row.severity} fill={SEVERITY_COLORS[row.severity]} />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Compliance by vendor" subtitle="Weighted rule pass rate">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byVendor} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#1e242f" vertical={false} />
                <XAxis dataKey="vendor" {...CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} {...CHART_AXIS} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip()} />
                <Bar dataKey="compliance" fill="#3d7dff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Framework coverage" subtitle="Controls passing per framework">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={coverage} outerRadius="72%">
                <PolarGrid stroke="#1e242f" />
                <PolarAngleAxis dataKey="framework" tick={{ fill: '#8b95a7', fontSize: 10 }} />
                <Radar dataKey="score" stroke="#38c793" fill="#38c793" fillOpacity={0.22} />
                <Tooltip {...chartTooltip()} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Third-party risk" subtitle="Concentration score per vendor">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={thirdParty} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 12 }}>
                <CartesianGrid stroke="#1e242f" horizontal={false} />
                <XAxis type="number" {...CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="vendor" width={70} {...CHART_AXIS} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip()} />
                <Bar dataKey="score" fill="#ff9147" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Drift activity" subtitle="Configuration changes detected">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driftActivity} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#1e242f" vertical={false} />
                <XAxis dataKey="at" {...CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis {...CHART_AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...chartTooltip()} />
                <Bar dataKey="count" fill="#e8c74a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Recent findings"
          actions={
          <Link to="/findings" className="text-xs text-accent hover:underline">
              View all
            </Link>
          }
          bodyClassName="p-0">
          
          <ul className="divide-y divide-hairline/60">
            {open.slice(0, 6).map((f) =>
            <li key={f.id}>
                <Link
                to={`/findings/${f.id}`}
                className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-white/[0.03]">
                
                  <Badge tone={f.severity}>{f.severity}</Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{f.title}</p>
                    <p className="truncate text-xs text-muted">
                      {f.deviceName ?? f.category} · {f.frameworks.join(' · ') || 'internal policy'}
                    </p>
                  </div>
                </Link>
              </li>
            )}
            {!open.length && <li className="px-4 py-6 text-sm text-muted">No open findings.</li>}
          </ul>
        </Panel>
      </div>
    </>);

}