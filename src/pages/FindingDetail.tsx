import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { BotIcon, ShieldIcon, WrenchIcon } from 'lucide-react';
import { RULES_BY_ID } from '../data/complianceRules';
import { buildAIPayload } from '../engine/ai';
import { SEVERITY_WEIGHT } from '../engine/risk';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  PathTrail,
  Select } from
'../components/ui/primitives';

export function FindingDetailPage() {
  const { id } = useParams();
  const { findings, requestExplanation, requestRemediation, setFindingStatus, aiModel } = useNexus();
  const finding = findings.find((f) => f.id === id);

  if (!finding) {
    return (
      <EmptyState
        title="Finding not found"
        description="It may have been resolved by a configuration change and removed on the last audit."
        actions={
        <Link to="/findings">
            <Button variant="primary">Back to findings</Button>
          </Link>
        } />);


  }

  const rule = finding.ruleId ? RULES_BY_ID[finding.ruleId] : undefined;
  const payload = buildAIPayload(finding);

  return (
    <>
      <PageHeader
        title={finding.title}
        description={finding.summary}
        actions={
        <>
            <Badge tone={finding.severity}>{finding.severity}</Badge>
            <Select
            value={finding.status}
            onChange={(e) => setFindingStatus(finding.id, e.target.value as typeof finding.status)}
            className="w-40 py-1.5 text-xs"
            aria-label="Finding status">
            
              <option>Open</option>
              <option>Investigating</option>
              <option>Resolved</option>
            </Select>
          </>
        } />
      

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title="Intent vs actual">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-hairline bg-elevated px-3 py-3">
                <p className="text-2xs uppercase tracking-wider text-faint">Expected</p>
                <p className="mt-1 text-sm font-semibold text-ink">{finding.intent ?? 'baseline state'}</p>
              </div>
              <div className="rounded-md border border-critical/40 bg-critical/10 px-3 py-3">
                <p className="text-2xs uppercase tracking-wider text-critical/80">Actual</p>
                <p className="mt-1 text-sm font-semibold text-critical">{finding.actual ?? 'divergent'}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Evidence">
            {finding.evidence.map((e, i) =>
            <KeyValue key={i} label={e.label} value={e.value} mono />
            )}
          </Panel>

          {finding.path && finding.path.length > 0 &&
          <Panel title="Reachability path" subtitle="Rules responsible for each hop">
              <PathTrail hops={finding.path} />
            </Panel>
          }

          <Panel
            title="AI explanation"
            subtitle={`Model: ${aiModel} · secrets are redacted before analysis`}
            actions={
            <Button
              size="sm"
              variant="primary"
              icon={<BotIcon className="h-4 w-4" />}
              onClick={() => requestExplanation(finding.id)}>
              
                {finding.aiExplanation ? 'Regenerate' : 'AI Explain'}
              </Button>
            }>
            
            {finding.aiExplanation ?
            <div className="space-y-3 text-sm">
                <div>
                  <p className="text-2xs uppercase tracking-wider text-faint">What happened</p>
                  <p className="mt-1 text-ink">{finding.aiExplanation.whatHappened}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-faint">Why it matters</p>
                  <p className="mt-1 text-muted">{finding.aiExplanation.whyItMatters}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-faint">Potential impact</p>
                  <p className="mt-1 text-muted">{finding.aiExplanation.potentialImpact}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-faint">Compliance implications</p>
                  <p className="mt-1 text-muted">{finding.aiExplanation.complianceImplications}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-faint">Recommendation</p>
                  <p className="mt-1 text-muted">{finding.aiExplanation.recommendation}</p>
                </div>
                <p className="text-2xs text-faint">
                  Generated {format(new Date(finding.aiExplanation.generatedAt), 'PPp')}
                </p>
              </div> :

            <p className="text-sm text-muted">
                Ask the assistant to explain this finding. It receives only the structured, redacted
                security data shown below — never credentials, keys or community strings.
              </p>
            }
          </Panel>

          <Panel
            title="Remediation"
            subtitle="Vendor-specific guidance — never executed automatically"
            actions={
            <Button
              size="sm"
              icon={<WrenchIcon className="h-4 w-4" />}
              onClick={() => requestRemediation(finding.id)}>
              
                {finding.remediation ? 'Regenerate' : 'Generate Remediation'}
              </Button>
            }>
            
            {finding.remediation ?
            <div className="space-y-3">
                <p className="text-sm text-ink">{finding.remediation.recommendation}</p>
                <pre className="overflow-x-auto rounded-md border border-hairline bg-canvas p-3 font-mono text-2xs leading-relaxed text-muted">
                  {finding.remediation.commands.join('\n')}
                </pre>
                <p className="text-xs font-medium text-high">Review before applying to production.</p>
              </div> :

            <p className="text-sm text-muted">
                Generate a {finding.vendor ?? 'vendor'}-specific recommendation for this finding.
              </p>
            }
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Classification">
            <KeyValue label="Category" value={finding.category} />
            <KeyValue label="Device" value={finding.deviceName ?? 'multiple / fleet-wide'} />
            <KeyValue label="Vendor" value={finding.vendor ?? 'multiple'} />
            <KeyValue label="Environment" value={finding.environment ?? 'n/a'} />
            <KeyValue label="Detected" value={format(new Date(finding.createdAt), 'PPp')} />
            <KeyValue
              label="Risk contribution"
              value={`${SEVERITY_WEIGHT[finding.severity]} weight · ×${finding.riskWeight} factor`} />
            
          </Panel>

          <Panel title="Compliance mappings">
            {finding.frameworks.length ?
            <ul className="space-y-1.5 text-sm">
                {finding.frameworks.map((f) =>
              <li key={f} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{f}</span>
                    <span className="font-mono text-xs text-ink">
                      {rule?.frameworks[f] ?? 'mapped control'}
                    </span>
                  </li>
              )}
              </ul> :

            <p className="text-sm text-muted">No framework mapping.</p>
            }
            {rule &&
            <Link
              to={`/compliance/${rule.id}`}
              className="mt-3 inline-block text-xs text-accent hover:underline">
              
                View rule {rule.id}
              </Link>
            }
          </Panel>

          <Panel title="Affected assets">
            {finding.affectedAssets.length ?
            <ul className="space-y-1 text-sm text-ink">
                {finding.affectedAssets.map((a) =>
              <li key={a}>{a}</li>
              )}
              </ul> :

            <p className="text-sm text-muted">No specific assets tagged.</p>
            }
          </Panel>

          <Panel
            title="Data sent to AI"
            subtitle="Redacted, structured payload"
            actions={<ShieldIcon className="h-4 w-4 text-ok" />}>
            
            <pre className="max-h-64 overflow-auto rounded-md border border-hairline bg-canvas p-3 font-mono text-2xs leading-relaxed text-muted">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </Panel>
        </div>
      </div>
    </>);

}