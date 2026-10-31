import '@xyflow/react/dist/style.css';
import React, { useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildDependencyGraph, concentrationByAsset } from '../engine/dependencies';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  Select,
  StatTile,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function DependenciesPage() {
  const { db, orgId, analysis } = useNexus();
  const assets = db.assets.filter((a) => a.orgId === orgId);
  const vendors = db.vendors.filter((v) => v.orgId === orgId);
  const assetEdges = db.dependencies.filter((d) => d.orgId === orgId);
  const [focus, setFocus] = useState('all');

  const graph = useMemo(
    () => buildDependencyGraph(vendors, assets, assetEdges),
    [vendors, assets, assetEdges]
  );

  const concentration = useMemo(
    () => concentrationByAsset(vendors, assets, assetEdges),
    [vendors, assets, assetEdges]
  );

  const { nodes, edges } = useMemo(() => {
    const columns: Record<string, number> = { vendor: 0, transport: 1, asset: 2 };
    const counters: Record<string, number> = { vendor: 0, transport: 0, asset: 0 };
    const chain = ['Vendor Network', 'Jump Server', 'Application Server', 'Production Database', 'Cloud Replica'];

    const focusVendor = focus === 'all' ? null : focus;
    const focusRisk = analysis.vendorRisks.find((v) => v.vendor.name === focusVendor);
    const allowed = focusRisk ?
    new Set([
    focusRisk.vendor.name,
    `${focusRisk.vendor.name} ${focusRisk.vendor.connectionType}`,
    ...focusRisk.directDependencies,
    ...focusRisk.indirectDependencies,
    ...focusRisk.cascadePath]
    ) :
    null;

    const nodeList: Node[] = graph.nodes.
    filter((n) => !allowed || allowed.has(n.id)).
    map((n) => {
      const col = columns[n.kind];
      const chainIndex = chain.indexOf(n.id);
      const row = chainIndex >= 0 ? chainIndex : counters[n.kind];
      counters[n.kind] += 1;
      return {
        id: n.id,
        position: { x: col * 300, y: row * 96 },
        data: { label: n.id },
        style: {
          background:
          n.kind === 'vendor' ? '#1d1710' : n.criticality === 'Critical' ? '#1c1013' : '#12161f',
          border: `1px solid ${
          n.kind === 'vendor' ? '#ff9147' : n.criticality === 'Critical' ? '#ff4d5e' : '#2a323f'}`,

          borderRadius: 8,
          color: '#e8ecf3',
          fontSize: 11,
          padding: '8px 12px',
          width: 190
        }
      };
    });

    const ids = new Set(nodeList.map((n) => n.id));
    const edgeList: Edge[] = graph.edges.
    filter((e) => ids.has(e.from) && ids.has(e.to)).
    map((e, i) => ({
      id: `dep-${i}`,
      source: e.from,
      target: e.to,
      label: e.label ?? e.kind,
      animated: e.kind === 'ALLOWS',
      style: { stroke: e.kind === 'ALLOWS' ? '#ff9147' : '#2a323f' }
    }));

    return { nodes: nodeList, edges: edgeList };
  }, [graph, focus, analysis.vendorRisks]);

  if (!assets.length) {
    return (
      <>
        <PageHeader title="Dependencies" description="Direct, indirect, critical and cascading dependency analysis." />
        <EmptyState title="No dependency model" description="Load the demo environment to model third-party dependencies." />
      </>);

  }

  return (
    <>
      <PageHeader
        title="Dependencies"
        description="How third-party access propagates through the estate — direct, indirect, concentration and potential cascading impact." />
      

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Nodes" value={graph.nodes.length} />
        <StatTile label="Edges" value={graph.edges.length} />
        <StatTile
          label="Single points of failure"
          value={analysis.vendorRisks.filter((v) => v.singlePointOfFailure).length}
          tone="high" />
        
        <StatTile
          label="Most concentrated asset"
          value={concentration[0]?.asset ?? '—'}
          hint={concentration[0] ? `${concentration[0].vendors} vendor path(s)` : undefined}
          tone="critical" />
        
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          bodyClassName="p-0"
          title="Dependency graph"
          actions={
          <Select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="w-40 py-1.5 text-xs"
            aria-label="Focus on vendor">
            
              <option value="all">All dependencies</option>
              {vendors.map((v) =>
            <option key={v.id} value={v.name}>
                  {v.name} chain
                </option>
            )}
            </Select>
          }>
          
          <div className="h-[520px]">
            <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.3} proOptions={{ hideAttribution: true }}>
              <Background color="#1e242f" gap={22} />
              <Controls className="!border-hairline !bg-surface" />
            </ReactFlow>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Concentration risk" subtitle="Vendor paths reaching each asset">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={concentration}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                  
                  <CartesianGrid stroke="#1e242f" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#5d6779" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="asset"
                    width={112}
                    stroke="#5d6779"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false} />
                  
                  <Tooltip
                    contentStyle={{
                      background: '#12161f',
                      border: '1px solid #2a323f',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#e8ecf3'
                    }} />
                  
                  <Bar dataKey="vendors" fill="#ff9147" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Potential cascading impact" bodyClassName="p-0">
            <ul className="divide-y divide-hairline/60">
              {analysis.vendorRisks.map((v) =>
              <li key={v.vendor.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{v.vendor.name}</p>
                    <Badge tone={v.concentrationRisk}>{v.concentrationRisk}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-2xs leading-relaxed text-muted">
                    {v.cascadePath.join(' → ')}
                  </p>
                  <p className="mt-1 text-2xs text-faint">
                    Potential impact only — not a confirmed compromise.
                  </p>
                </li>
              )}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel className="mt-4" title="Dependency inventory" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>From</Th>
              <Th>Relationship</Th>
              <Th>To</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {graph.edges.map((e, i) =>
            <tr key={`edge-${i}`}>
                <Td>{e.from}</Td>
                <Td>
                  <Badge tone={e.kind === 'ALLOWS' ? 'MEDIUM' : 'neutral'}>{e.kind}</Badge>
                </Td>
                <Td>{e.to}</Td>
                <Td className="font-mono text-xs text-muted">{e.label ?? '—'}</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </>);

}