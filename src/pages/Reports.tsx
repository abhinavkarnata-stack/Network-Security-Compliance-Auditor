import React from 'react';
import { format } from 'date-fns';
import { DownloadIcon, FileTextIcon, PrinterIcon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import type { Report } from '../types/nexus';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

const TYPES: Report['type'][] = [
'Security Audit',
'Compliance',
'Reachability',
'Third-Party Risk',
'Drift',
'Remediation'];


function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(report: Report): string {
  const rows: string[][] = [['section', 'key', 'value']];
  const walk = (section: string, value: unknown, key = '') => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(section, v, `${key}[${i}]`));
    } else if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      walk(section, v, key ? `${key}.${k}` : k)
      );
    } else {
      rows.push([section, key, String(value).replace(/"/g, "'")]);
    }
  };
  Object.entries(report.payload).forEach(([section, value]) => walk(section, value));
  return rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
}

export function ReportsPage() {
  const { db, orgId, generateReport, analysis, hasData } = useNexus();
  const reports = db.reports.filter((r) => r.orgId === orgId);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Executive and technical reporting built from the deterministic audit output. Secrets are stripped before a report is stored." />
      

      <Panel title="Generate a report" subtitle="Every report captures the current posture snapshot">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) =>
          <Button
            key={t}
            icon={<FileTextIcon className="h-4 w-4" />}
            onClick={() => generateReport(t)}
            disabled={!hasData}>
            
              {t}
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Current posture: security score {analysis.risk.overall}/100 · compliance{' '}
          {analysis.complianceScore}% · {analysis.driftEvents.length} drift events ·{' '}
          {analysis.vendorRisks.length} third parties.
        </p>
      </Panel>

      {!reports.length ?
      <div className="mt-4">
          <EmptyState
          title="No reports yet"
          description="Generate a security audit, compliance, reachability, third-party, drift or remediation report to export the current findings." />
        
        </div> :

      <Panel className="mt-4" title={`${reports.length} generated reports`} bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Report</Th>
                <Th>Type</Th>
                <Th>Generated</Th>
                <Th>By</Th>
                <Th>Score</Th>
                <Th className="text-right">Export</Th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) =>
            <tr key={r.id}>
                  <Td className="font-medium">{r.title}</Td>
                  <Td>
                    <Badge tone="neutral">{r.type}</Badge>
                  </Td>
                  <Td className="text-xs text-muted">{format(new Date(r.generatedAt), 'PPp')}</Td>
                  <Td className="text-xs text-muted">{r.generatedBy}</Td>
                  <Td className="tabular-nums">{String(r.payload.securityScore ?? '—')}/100</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button
                    size="sm"
                    icon={<DownloadIcon className="h-3.5 w-3.5" />}
                    onClick={() =>
                    download(
                      `${r.type.replace(/\s+/g, '-').toLowerCase()}-${r.id}.json`,
                      JSON.stringify(r.payload, null, 2),
                      'application/json'
                    )
                    }>
                    
                        JSON
                      </Button>
                      <Button
                    size="sm"
                    icon={<DownloadIcon className="h-3.5 w-3.5" />}
                    onClick={() =>
                    download(
                      `${r.type.replace(/\s+/g, '-').toLowerCase()}-${r.id}.csv`,
                      toCsv(r),
                      'text/csv'
                    )
                    }>
                    
                        CSV
                      </Button>
                      <Button
                    size="sm"
                    icon={<PrinterIcon className="h-3.5 w-3.5" />}
                    onClick={() => window.print()}>
                    
                        PDF
                      </Button>
                    </div>
                  </Td>
                </tr>
            )}
            </tbody>
          </Table>
        </Panel>
      }

      {reports[0] &&
      <Panel className="mt-4" title="Latest report preview" subtitle={reports[0].title}>
          <pre className="max-h-96 overflow-auto rounded-md border border-hairline bg-canvas p-3 font-mono text-2xs leading-relaxed text-muted">
            {JSON.stringify(reports[0].payload, null, 2)}
          </pre>
        </Panel>
      }
    </>);

}