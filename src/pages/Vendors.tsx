import React from 'react';
import { Link } from 'react-router-dom';
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

export function VendorsPage() {
  const { analysis, hasData, loadDemoEnvironment } = useNexus();
  const risks = analysis.vendorRisks;

  if (!risks.length) {
    return (
      <>
        <PageHeader title="Vendors" description="Third-party connections, the assets they reach and their concentration risk." />
        <EmptyState
          title="No third parties modelled"
          description="Third-party connections are part of the demo environment, or can be represented as structured connection data."
          actions={
          !hasData ?
          <Button variant="primary" onClick={loadDemoEnvironment}>
                Load Demo Environment
              </Button> :
          undefined
          } />
        
      </>);

  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Every third party, the transport it uses, and everything downstream of that access." />
      

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Third parties" value={risks.length} />
        <StatTile
          label="High / critical"
          value={risks.filter((r) => r.concentrationRisk !== 'LOW' && r.concentrationRisk !== 'MEDIUM').length}
          tone="high" />
        
        <StatTile
          label="Critical assets in reach"
          value={new Set(risks.flatMap((r) => r.criticalAssets)).size}
          tone="critical" />
        
        <StatTile label="Third-party risk score" value={`${analysis.risk.thirdParty}/100`} tone="medium" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {risks.map((r) =>
        <Panel
          key={r.vendor.id}
          title={r.vendor.name}
          subtitle={`${r.vendor.connectionType} · ${r.vendor.service}`}
          actions={<Badge tone={r.concentrationRisk}>{r.concentrationRisk}</Badge>}>
          
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Connections</dt>
              <dd className="text-right tabular-nums text-ink">{r.connections}</dd>
              <dt className="text-muted">Dependent systems</dt>
              <dd className="text-right tabular-nums text-ink">{r.dependentSystems}</dd>
              <dt className="text-muted">Critical assets</dt>
              <dd className="text-right tabular-nums text-critical">{r.criticalAssets.length}</dd>
              <dt className="text-muted">Sensitive assets</dt>
              <dd className="text-right tabular-nums text-high">{r.sensitiveAssets.length}</dd>
              <dt className="text-muted">Single point of failure</dt>
              <dd className="text-right text-ink">{r.singlePointOfFailure ? 'yes' : 'no'}</dd>
            </dl>

            <div className="mt-3 rounded-md border border-hairline bg-elevated px-3 py-2">
              <p className="text-2xs uppercase tracking-wider text-faint">Potential cascading impact</p>
              <p className="mt-1 font-mono text-2xs leading-relaxed text-muted">
                {r.cascadePath.join(' → ')}
              </p>
            </div>

            <div className="mt-3 space-y-1 text-xs text-muted">
              {r.vendor.connections.map((c, i) =>
            <p key={i} className="font-mono">
                  {c.source} → {c.destination} · {c.protocol.toUpperCase()}/{c.port}
                  {(c.protocol === 'any' || c.port === 'any') &&
              <span className="ml-1.5 text-critical">over-broad</span>
              }
                </p>
            )}
            </div>

            <Link to="/dependencies" className="mt-3 inline-block text-xs text-accent hover:underline">
              View dependency graph
            </Link>
          </Panel>
        )}
      </div>

      <Panel className="mt-4" title="Third-party access summary" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Vendor</Th>
              <Th>Transport</Th>
              <Th>Entry point</Th>
              <Th className="text-right">Connections</Th>
              <Th>Direct dependencies</Th>
              <Th>Indirect dependencies</Th>
              <Th>Concentration risk</Th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) =>
            <tr key={r.vendor.id}>
                <Td className="font-medium">{r.vendor.name}</Td>
                <Td className="text-muted">{r.vendor.connectionType}</Td>
                <Td className="text-muted">
                  {r.vendor.entryAsset} ({r.vendor.entryZone})
                </Td>
                <Td className="text-right tabular-nums">{r.connections}</Td>
                <Td className="text-xs text-muted">{r.directDependencies.join(', ') || 'none'}</Td>
                <Td className="text-xs text-muted">{r.indirectDependencies.join(', ') || 'none'}</Td>
                <Td>
                  <Badge tone={r.concentrationRisk}>{r.concentrationRisk}</Badge>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </>);

}