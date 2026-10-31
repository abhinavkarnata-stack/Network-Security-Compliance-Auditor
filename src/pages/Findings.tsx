import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  Select,
  StatTile } from
'../components/ui/primitives';

const ALL = 'all';

export function FindingsPage() {
  const { findings, analysis, hasData } = useNexus();
  const [severity, setSeverity] = useState(ALL);
  const [vendor, setVendor] = useState(ALL);
  const [device, setDevice] = useState(ALL);
  const [framework, setFramework] = useState(ALL);
  const [environment, setEnvironment] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState('open');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
    findings.filter(
      (f) =>
      (severity === ALL || f.severity === severity) && (
      vendor === ALL || f.vendor === vendor) && (
      device === ALL || f.deviceName === device) && (
      framework === ALL || f.frameworks.includes(framework as never)) && (
      environment === ALL || f.environment === environment) && (
      category === ALL || f.category === category) && (
      status === ALL || (status === 'open' ? f.status !== 'Resolved' : f.status === status)) && (
      !query || `${f.title} ${f.summary}`.toLowerCase().includes(query.toLowerCase()))
    ),
    [findings, severity, vendor, device, framework, environment, category, status, query]
  );

  if (!hasData) {
    return (
      <>
        <PageHeader title="Findings" description="Central management of every violation the engines produce." />
        <EmptyState title="No findings" description="Findings appear once configurations are parsed and audited." />
      </>);

  }

  const counts = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({
    severity: s,
    count: findings.filter((f) => f.severity === s && f.status !== 'Resolved').length
  }));

  return (
    <>
      <PageHeader
        title="Findings"
        description="Compliance failures, intent violations, segmentation and reachability exposure, third-party risk and drift — in one queue." />
      

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counts.map((c) =>
        <StatTile
          key={c.severity}
          label={c.severity}
          value={c.count}
          tone={
          c.severity === 'CRITICAL' ?
          'critical' :
          c.severity === 'HIGH' ?
          'high' :
          c.severity === 'MEDIUM' ?
          'medium' :
          'accent'
          } />

        )}
        <StatTile label="Security score" value={`${analysis.risk.overall}/100`} />
      </div>

      <Panel
        bodyClassName="p-0"
        title={`${filtered.length} finding${filtered.length === 1 ? '' : 's'}`}
        actions={
        <div className="flex flex-wrap items-center gap-2">
            <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-36 py-1.5 text-xs"
            aria-label="Search findings" />
          
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-28 py-1.5 text-xs" aria-label="Severity">
              <option value={ALL}>Severity</option>
              <option>CRITICAL</option>
              <option>HIGH</option>
              <option>MEDIUM</option>
              <option>LOW</option>
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-36 py-1.5 text-xs" aria-label="Category">
              <option value={ALL}>Category</option>
              {Array.from(new Set(findings.map((f) => f.category))).map((c) =>
            <option key={c}>{c}</option>
            )}
            </Select>
            <Select value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-28 py-1.5 text-xs" aria-label="Vendor">
              <option value={ALL}>Vendor</option>
              {Array.from(new Set(findings.map((f) => f.vendor).filter(Boolean))).map((v) =>
            <option key={v as string}>{v as string}</option>
            )}
            </Select>
            <Select value={device} onChange={(e) => setDevice(e.target.value)} className="w-36 py-1.5 text-xs" aria-label="Device">
              <option value={ALL}>Device</option>
              {Array.from(new Set(findings.map((f) => f.deviceName).filter(Boolean))).map((d) =>
            <option key={d as string}>{d as string}</option>
            )}
            </Select>
            <Select value={framework} onChange={(e) => setFramework(e.target.value)} className="w-32 py-1.5 text-xs" aria-label="Framework">
              <option value={ALL}>Framework</option>
              {analysis.frameworkCoverage.map((f) =>
            <option key={f.framework}>{f.framework}</option>
            )}
            </Select>
            <Select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="w-32 py-1.5 text-xs" aria-label="Environment">
              <option value={ALL}>Environment</option>
              {Array.from(new Set(findings.map((f) => f.environment).filter(Boolean))).map((e) =>
            <option key={e as string}>{e as string}</option>
            )}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32 py-1.5 text-xs" aria-label="Status">
              <option value="open">Open + investigating</option>
              <option value={ALL}>All statuses</option>
              <option value="Open">Open</option>
              <option value="Investigating">Investigating</option>
              <option value="Resolved">Resolved</option>
            </Select>
          </div>
        }>
        
        <ul className="divide-y divide-hairline/60">
          {filtered.map((f) =>
          <li key={f.id} className="px-4 py-3.5 transition-colors duration-150 ease-out hover:bg-white/[0.03]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.severity}>{f.severity}</Badge>
                    <Badge tone="neutral">{f.category}</Badge>
                    {f.status !== 'Open' && <Badge tone="accent">{f.status}</Badge>}
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-ink">{f.title}</p>
                  <p className="mt-0.5 max-w-3xl text-xs text-muted">{f.summary}</p>
                  <p className="mt-1.5 text-2xs text-faint">
                    {[
                  f.deviceName,
                  f.vendor,
                  f.environment,
                  f.frameworks.join(' · '),
                  `${formatDistanceToNow(new Date(f.createdAt))} ago`].

                  filter(Boolean).
                  join('  ·  ')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {f.intent &&
                <p className="text-2xs text-muted">
                      Intent <span className="font-mono text-ink">{f.intent}</span> · Actual{' '}
                      <span className="font-mono text-critical">{f.actual}</span>
                    </p>
                }
                  <Link to={`/findings/${f.id}`}>
                    <Button size="sm">Investigate</Button>
                  </Link>
                </div>
              </div>
            </li>
          )}
          {!filtered.length &&
          <li className="px-4 py-10 text-center text-sm text-muted">No findings match these filters.</li>
          }
        </ul>
      </Panel>
    </>);

}