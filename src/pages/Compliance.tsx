import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COMPLIANCE_RULES, FRAMEWORK_DESCRIPTIONS } from '../data/complianceRules';
import { useNexus } from '../store/NexusContext';
import type { Framework } from '../types/nexus';
import {
  Badge,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  Select,
  StatTile,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function CompliancePage() {
  const { analysis, hasData } = useNexus();
  const [framework, setFramework] = useState<'all' | Framework>('all');
  const [severity, setSeverity] = useState('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () =>
    COMPLIANCE_RULES.filter(
      (rule) =>
      (framework === 'all' || Boolean(rule.frameworks[framework])) && (
      severity === 'all' || rule.severity === severity) && (
      !query || `${rule.id} ${rule.name} ${rule.category}`.toLowerCase().includes(query.toLowerCase()))
    ).map((rule) => {
      const results = analysis.ruleResults.filter((r) => r.ruleId === rule.id);
      const failed = results.filter((r) => r.status === 'FAIL');
      return { rule, total: results.length, failed: failed.length };
    }),
    [analysis.ruleResults, framework, severity, query]
  );

  if (!hasData) {
    return (
      <>
        <PageHeader title="Compliance" description="Deterministic rule engine — the AI layer never decides PASS/FAIL." />
        <EmptyState
          title="Nothing to evaluate yet"
          description="Upload a configuration or load the demo environment to run the 24-rule baseline against your fleet." />
        
      </>);

  }

  return (
    <>
      <PageHeader
        title="Compliance"
        description={`${COMPLIANCE_RULES.length} deterministic rules evaluated against every normalized configuration.`} />
      

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Overall" value={`${analysis.complianceScore}%`} />
        {analysis.frameworkCoverage.map((f) =>
        <StatTile
          key={f.framework}
          label={f.framework}
          value={`${f.score}%`}
          hint={`${f.passed}/${f.total} checks`}
          tone={f.score >= 85 ? 'ok' : f.score >= 65 ? 'medium' : 'critical'} />

        )}
      </div>

      <Panel
        title="Rule results"
        subtitle={FRAMEWORK_DESCRIPTIONS[framework === 'all' ? 'CIS' : framework]}
        bodyClassName="p-0"
        actions={
        <div className="flex flex-wrap items-center gap-2">
            <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules"
            className="w-40 py-1.5 text-xs"
            aria-label="Search rules" />
          
            <Select
            value={framework}
            onChange={(e) => setFramework(e.target.value as 'all' | Framework)}
            className="w-36 py-1.5 text-xs"
            aria-label="Filter by framework">
            
              <option value="all">All frameworks</option>
              {analysis.frameworkCoverage.map((f) =>
            <option key={f.framework} value={f.framework}>
                  {f.framework}
                </option>
            )}
            </Select>
            <Select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-32 py-1.5 text-xs"
            aria-label="Filter by severity">
            
              <option value="all">All severities</option>
              <option>CRITICAL</option>
              <option>HIGH</option>
              <option>MEDIUM</option>
              <option>LOW</option>
            </Select>
          </div>
        }>
        
        <Table>
          <thead>
            <tr>
              <Th>Rule</Th>
              <Th>Category</Th>
              <Th>Severity</Th>
              <Th>Frameworks</Th>
              <Th className="text-right">Devices failing</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rule, total, failed }) =>
            <tr key={rule.id} className="transition-colors duration-150 ease-out hover:bg-white/[0.03]">
                <Td>
                  <Link to={`/compliance/${rule.id}`} className="font-medium text-ink hover:text-accent">
                    {rule.id} · {rule.name}
                  </Link>
                  <p className="mt-0.5 max-w-xl text-xs text-muted">{rule.description}</p>
                </Td>
                <Td className="text-muted">{rule.category}</Td>
                <Td>
                  <Badge tone={rule.severity}>{rule.severity}</Badge>
                </Td>
                <Td className="text-xs text-muted">{Object.keys(rule.frameworks).join(' · ')}</Td>
                <Td className="text-right tabular-nums">
                  {failed} / {total}
                </Td>
                <Td>
                  <Badge tone={failed ? 'FAIL' : 'PASS'}>{failed ? 'FAIL' : 'PASS'}</Badge>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </>);

}