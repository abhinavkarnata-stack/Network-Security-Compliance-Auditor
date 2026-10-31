import '@xyflow/react/dist/style.css';
import React, { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node } from
'@xyflow/react';
import { useNexus } from '../store/NexusContext';
import type { Protocol, Zone } from '../types/nexus';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  cn } from
'../components/ui/primitives';

const ZONE_POSITIONS: Record<string, {x: number;y: number;}> = {
  Internet: { x: 0, y: 40 },
  DMZ: { x: 300, y: 40 },
  Application: { x: 600, y: 40 },
  Database: { x: 900, y: 40 },
  Management: { x: 300, y: 300 },
  Vendor: { x: 0, y: 300 },
  Cloud: { x: 900, y: 300 }
};

const DEVICE_POSITIONS: Record<string, {x: number;y: number;}> = {
  'Fortinet-FW-01': { x: 150, y: 150 },
  'PaloAlto-FW-02': { x: 750, y: 150 },
  'Juniper-Edge-01': { x: 150, y: 420 },
  'Cisco-Core-01': { x: 600, y: 300 }
};

const ZONES: Zone[] = ['Internet', 'DMZ', 'Application', 'Database', 'Management', 'Vendor', 'Cloud'];

type Filter = 'all' | 'zones' | 'devices' | 'assets' | 'vendors';

export function TopologyPage() {
  const { db, orgId, hasData, checkReachability, analysis } = useNexus();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [probe, setProbe] = useState({ source: 'Internet' as Zone, destination: 'Database' as Zone, port: '3306' });

  const zones = db.topology_edges.filter((e) => e.orgId === orgId);
  const assets = db.assets.filter((a) => a.orgId === orgId);
  const vendors = db.vendors.filter((v) => v.orgId === orgId);

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];
    const zoneSet = new Set<string>();
    zones.forEach((e) => {
      zoneSet.add(e.from);
      zoneSet.add(e.to);
    });

    const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());
    const highlighted = (label: string) => highlight.includes(label);

    if (filter === 'all' || filter === 'zones') {
      Array.from(zoneSet).forEach((zone) => {
        nodeList.push({
          id: zone,
          position: ZONE_POSITIONS[zone] ?? { x: Math.random() * 600, y: 550 },
          data: { label: zone },
          style: nodeStyle(highlighted(zone) ? 'highlight' : 'zone', matches(zone))
        });
      });
    }

    if (filter === 'all' || filter === 'devices') {
      Array.from(new Set(zones.map((z) => z.guard))).forEach((device) => {
        nodeList.push({
          id: device,
          position: DEVICE_POSITIONS[device] ?? { x: 450, y: 550 },
          data: { label: device },
          style: nodeStyle(highlighted(device) ? 'highlight' : 'device', matches(device))
        });
      });
    }

    if (filter === 'all' || filter === 'assets') {
      assets.
      filter((a) => a.zone !== 'Internet').
      forEach((asset, i) => {
        const base = ZONE_POSITIONS[asset.zone] ?? { x: 0, y: 0 };
        nodeList.push({
          id: asset.name,
          position: { x: base.x + 20, y: base.y + 90 + i % 2 * 56 },
          data: { label: `${asset.name}\n${asset.ip}` },
          style: nodeStyle(
            highlighted(asset.name) ?
            'highlight' :
            asset.criticality === 'Critical' ?
            'critical' :
            'asset',
            matches(asset.name)
          )
        });
        edgeList.push({
          id: `az-${asset.name}`,
          source: asset.zone,
          target: asset.name,
          label: 'CONNECTS_TO',
          style: { stroke: '#2a323f' }
        });
      });
    }

    if (filter === 'all' || filter === 'vendors') {
      vendors.forEach((v, i) => {
        nodeList.push({
          id: v.name,
          position: { x: -260, y: 120 + i * 110 },
          data: { label: `${v.name}\n${v.connectionType}` },
          style: nodeStyle(highlighted(v.name) ? 'highlight' : 'vendor', matches(v.name))
        });
        edgeList.push({
          id: `vz-${v.name}`,
          source: v.name,
          target: v.entryZone,
          label: 'DEPENDS_ON',
          style: { stroke: '#ff9147' }
        });
      });
    }

    zones.forEach((e) => {
      const guardHasNodes = filter === 'all' || filter === 'devices';
      if (guardHasNodes && (filter === 'all' || filter === 'zones')) {
        edgeList.push({
          id: `${e.from}-${e.guard}-${e.to}-a`,
          source: e.from,
          target: e.guard,
          label: 'ROUTES_TO',
          animated: highlight.includes(e.from) && highlight.includes(e.guard),
          style: { stroke: '#2a323f' }
        });
        edgeList.push({
          id: `${e.from}-${e.guard}-${e.to}-b`,
          source: e.guard,
          target: e.to,
          label: e.label,
          animated: highlight.includes(e.guard) && highlight.includes(e.to),
          style: { stroke: '#2a323f' }
        });
      } else if (filter === 'zones') {
        edgeList.push({
          id: `${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          label: e.label,
          style: { stroke: '#2a323f' }
        });
      }
    });

    const ids = new Set(nodeList.map((n) => n.id));
    return { nodes: nodeList, edges: edgeList.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [zones, assets, vendors, filter, query, highlight]);

  const selectedAsset = assets.find((a) => a.name === selected);
  const selectedVendor = vendors.find((v) => v.name === selected);
  const selectedDevice = analysis.deviceUpdates.find((d) => d.name === selected);

  if (!hasData) {
    return (
      <>
        <PageHeader title="Topology" description="Interactive model of zones, enforcement points, assets and third parties." />
        <EmptyState title="No topology yet" description="Load the demo environment or upload configurations to build the graph." />
      </>);

  }

  return (
    <>
      <PageHeader
        title="Topology"
        description="Zones, enforcement devices, assets and vendor connections. Select a node for detail or highlight a reachability path." />
      

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel bodyClassName="p-0" title="Network graph" actions={
        <div className="flex flex-wrap items-center gap-2">
            <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes"
            className="w-36 py-1.5 text-xs"
            aria-label="Search nodes" />
          
            <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="w-32 py-1.5 text-xs"
            aria-label="Filter nodes">
            
              <option value="all">All nodes</option>
              <option value="zones">Zones only</option>
              <option value="devices">Devices only</option>
              <option value="assets">Assets</option>
              <option value="vendors">Vendors</option>
            </Select>
          </div>
        }>
          <div className="h-[560px] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              minZoom={0.25}
              proOptions={{ hideAttribution: true }}
              onNodeClick={(_, node) => setSelected(node.id)}>
              
              <Background color="#1e242f" gap={22} />
              <Controls className="!border-hairline !bg-surface" />
              <MiniMap
                pannable
                zoomable
                style={{ background: '#0d1017', border: '1px solid #1e242f' }}
                nodeColor="#2a323f" />
              
            </ReactFlow>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Highlight path">
            <div className="space-y-3">
              <Field label="Source">
                <Select
                  value={probe.source}
                  onChange={(e) => setProbe({ ...probe, source: e.target.value as Zone })}>
                  
                  {ZONES.map((z) =>
                  <option key={z}>{z}</option>
                  )}
                </Select>
              </Field>
              <Field label="Destination">
                <Select
                  value={probe.destination}
                  onChange={(e) => setProbe({ ...probe, destination: e.target.value as Zone })}>
                  
                  {ZONES.map((z) =>
                  <option key={z}>{z}</option>
                  )}
                </Select>
              </Field>
              <Field label="Port">
                <Input value={probe.port} onChange={(e) => setProbe({ ...probe, port: e.target.value })} />
              </Field>
              <Button
                className="w-full"
                variant="primary"
                onClick={() => {
                  const result = checkReachability(
                    probe.source,
                    probe.destination,
                    'tcp' as Protocol,
                    probe.port
                  );
                  const path = result.paths.find((p) => p.reachable) ?? result.paths[0];
                  setHighlight(path ? path.hops.map((h) => h.node) : []);
                }}>
                
                Highlight
              </Button>
              {highlight.length > 0 &&
              <p className="text-xs text-muted">
                  Highlighted: <span className="font-mono">{highlight.join(' → ')}</span>
                </p>
              }
            </div>
          </Panel>

          <Panel title="Node detail">
            {!selected ?
            <p className="text-sm text-muted">Select a node in the graph.</p> :
            selectedAsset ?
            <div className="space-y-2 text-sm">
                <p className="font-medium text-ink">{selectedAsset.name}</p>
                <Badge tone={selectedAsset.criticality === 'Critical' ? 'CRITICAL' : 'MEDIUM'}>
                  {selectedAsset.criticality}
                </Badge>
                <p className="text-muted">
                  {selectedAsset.type} · zone {selectedAsset.zone}
                </p>
                <p className="font-mono text-xs text-muted">{selectedAsset.ip}</p>
              </div> :
            selectedVendor ?
            <div className="space-y-2 text-sm">
                <p className="font-medium text-ink">{selectedVendor.name}</p>
                <p className="text-muted">
                  {selectedVendor.connectionType} · {selectedVendor.service}
                </p>
                <ul className="space-y-1 text-xs text-muted">
                  {selectedVendor.connections.map((c, i) =>
                <li key={i} className="font-mono">
                      {c.source} → {c.destination} {c.protocol.toUpperCase()}/{c.port}
                    </li>
                )}
                </ul>
              </div> :
            selectedDevice ?
            <div className="space-y-2 text-sm">
                <p className="font-medium text-ink">{selectedDevice.name}</p>
                <div className="flex gap-2">
                  <Badge tone={selectedDevice.risk}>{selectedDevice.risk}</Badge>
                  <Badge tone="neutral">{selectedDevice.compliance}% compliant</Badge>
                </div>
                <p className="text-muted">
                  {selectedDevice.vendor} {selectedDevice.type} · {selectedDevice.ip}
                </p>
              </div> :

            <div className="space-y-2 text-sm">
                <p className="font-medium text-ink">{selected}</p>
                <p className="text-muted">
                  Logical zone. Adjacent boundaries:{' '}
                  {zones.
                filter((z) => z.from === selected || z.to === selected).
                map((z) => `${z.from} ↔ ${z.to} via ${z.guard}`).
                join('; ')}
                </p>
              </div>
            }
          </Panel>

          <Panel title="Legend">
            <ul className="space-y-1.5 text-xs text-muted">
              <li className={cn('flex items-center gap-2')}>
                <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Enforcement device
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#2a323f]" /> Zone
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-critical" /> Critical asset
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-high" /> Third-party vendor
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>);

}

function nodeStyle(
kind: 'zone' | 'device' | 'asset' | 'critical' | 'vendor' | 'highlight',
matches: boolean)
: React.CSSProperties {
  const palette: Record<string, {bg: string;border: string;color: string;}> = {
    zone: { bg: '#12161f', border: '#2a323f', color: '#e8ecf3' },
    device: { bg: '#16233d', border: '#3d7dff', color: '#e8ecf3' },
    asset: { bg: '#0d1017', border: '#2a323f', color: '#8b95a7' },
    critical: { bg: '#1c1013', border: '#ff4d5e', color: '#ff8a95' },
    vendor: { bg: '#1d1710', border: '#ff9147', color: '#ffbd8a' },
    highlight: { bg: '#1c1013', border: '#ff4d5e', color: '#ffffff' }
  };
  const p = palette[kind];
  return {
    background: p.bg,
    border: `1px solid ${p.border}`,
    borderRadius: 8,
    color: p.color,
    fontSize: 11,
    padding: '8px 12px',
    width: 168,
    whiteSpace: 'pre-line',
    opacity: matches ? 1 : 0.25
  };
}