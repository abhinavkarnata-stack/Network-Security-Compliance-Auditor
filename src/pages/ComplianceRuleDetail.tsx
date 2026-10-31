import React from 'react';
import { Link, useParams } from 'react-router-dom';
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

export function ComplianceRuleDetailPage() {
  const { ruleId } = useParams();
  const { analysis, findings } = useNexus();
  const rule = ruleId ? RULES_BY_ID[ruleId] : undefined;

  if (!rule) return <EmptyState title="Rule not found" description="This rule is not part of the MVP baseline." />;

  const results = analysis.ruleResults.filter((r) => r.ruleId === rule.id);
  const finding = findings.find((f) => f.ruleId === rule.id);

  return (
    <>
      <PageHeader
        title={`${rule.id} · ${rule.name}`}
        description={rule.description}
        actions={<Badge tone={rule.severity}>{rule.severity}</Badge>} />
      

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Rule definition">
          <KeyValue label="Category" value={rule.category} />
          <KeyValue label="Evaluator" value={rule.operator} mono />
          {rule.field && <KeyValue label="Field" value={rule.field} mono />}
          {rule.expected !== undefined && <KeyValue label="Expected" value={String(rule.expected)} mono />}
          <KeyValue label="Remediation guidance" value={rule.remediationHint} />
          {finding &&
          <KeyValue
            label="Finding"
            value={
            <Link to={`/findings/${finding.id}`} className="text-accent hover:underline">
                  {finding.title}
                </Link>
            } />

          }
        </Panel>

        <Panel title="Framework mapping" className="lg:col-span-2" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Framework</Th>
                <Th>Control</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rule.frameworks).map(([framework, control]) =>
              <tr key={framework}>
                  <Td>{framework}</Td>
                  <Td className="font-mono text-xs text-muted">{control}</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Evaluation per device"
        subtitle={`${results.filter((r) => r.status === 'FAIL').length} failing of ${results.length} evaluated`}
        bodyClassName="p-0">
        
        <Table>
          <thead>
            <tr>
              <Th>Device</Th>
              <Th>Vendor</Th>
              <Th>Expected</Th>
              <Th>Actual</Th>
              <Th>Result</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) =>
            <tr key={`${r.ruleId}-${r.deviceId}`}>
                <Td>
                  <Link to={`/devices/${r.deviceId}`} className="text-ink hover:text-accent">
                    {r.deviceName}
                  </Link>
                </Td>
                <Td className="text-muted">{r.vendor}</Td>
                <Td className="font-mono text-xs text-muted">{r.expected}</Td>
                <Td className="font-mono text-xs text-muted">{r.actual}</Td>
                <Td>
                  <Badge tone={r.status}>{r.status}</Badge>
                </Td>
                <Td className="max-w-md text-xs text-muted">{r.detail}</Td>
              </tr>
            )}
            {!results.length &&
            <tr>
                <Td className="py-6 text-center text-muted">No configurations to evaluate.</Td>
              </tr>
            }
          </tbody>
        </Table>
      </Panel>
    </>);

}