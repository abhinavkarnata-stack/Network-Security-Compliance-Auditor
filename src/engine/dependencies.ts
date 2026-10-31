import type { Asset, DependencyEdge, Severity, ThirdPartyVendor } from '../types/nexus';

export interface DependencyGraph {
  nodes: {id: string;kind: 'vendor' | 'asset' | 'transport';criticality?: Asset['criticality'];}[];
  edges: DependencyEdge[];
}

export function buildDependencyGraph(
vendors: ThirdPartyVendor[],
assets: Asset[],
assetEdges: DependencyEdge[])
: DependencyGraph {
  const nodes: DependencyGraph['nodes'] = assets.map((a) => ({
    id: a.name,
    kind: 'asset',
    criticality: a.criticality
  }));
  const edges: DependencyEdge[] = [...assetEdges];

  vendors.forEach((v) => {
    nodes.push({ id: v.name, kind: 'vendor' });
    const transport = `${v.name} ${v.connectionType}`;
    nodes.push({ id: transport, kind: 'transport' });
    edges.push({ from: v.name, to: transport, kind: 'CONNECTS_TO', label: v.connectionType });
    v.connections.forEach((c) => {
      edges.push({
        from: transport,
        to: c.destination,
        kind: 'ALLOWS',
        label: `${c.protocol.toUpperCase()}/${c.port}`
      });
    });
  });

  return { nodes, edges };
}

function downstream(graph: DependencyGraph, start: string): {node: string;depth: number;}[] {
  const out: {node: string;depth: number;}[] = [];
  const seen = new Set<string>([start]);
  let frontier = [start];
  let depth = 0;
  while (frontier.length && depth < 8) {
    depth += 1;
    const next: string[] = [];
    frontier.forEach((n) => {
      graph.edges.
      filter((e) => e.from === n).
      forEach((e) => {
        if (seen.has(e.to)) return;
        seen.add(e.to);
        out.push({ node: e.to, depth });
        next.push(e.to);
      });
    });
    frontier = next;
  }
  return out;
}

export interface VendorRisk {
  vendor: ThirdPartyVendor;
  directDependencies: string[];
  indirectDependencies: string[];
  dependentSystems: number;
  criticalAssets: string[];
  sensitiveAssets: string[];
  connections: number;
  concentrationRisk: Severity;
  cascadePath: string[];
  singlePointOfFailure: boolean;
  score: number;
}

export function analyzeVendorRisk(
vendors: ThirdPartyVendor[],
assets: Asset[],
assetEdges: DependencyEdge[])
: VendorRisk[] {
  const graph = buildDependencyGraph(vendors, assets, assetEdges);
  const assetByName = new Map(assets.map((a) => [a.name, a]));

  const risks = vendors.map((vendor) => {
    const reach = downstream(graph, vendor.name).filter((r) => assetByName.has(r.node));
    const direct = reach.filter((r) => r.depth <= 2).map((r) => r.node);
    const indirect = reach.filter((r) => r.depth > 2).map((r) => r.node);
    const criticalAssets = reach.
    map((r) => assetByName.get(r.node)).
    filter((a): a is Asset => !!a && a.criticality === 'Critical').
    map((a) => a.name);
    const sensitiveAssets = reach.
    map((r) => assetByName.get(r.node)).
    filter((a): a is Asset => !!a && a.criticality === 'Sensitive').
    map((a) => a.name);

    const broadAccess = vendor.connections.some((c) => c.protocol === 'any' || c.port === 'any');
    const score =
    criticalAssets.length * 12 +
    sensitiveAssets.length * 6 +
    vendor.connections.length * 4 +
    indirect.length * 3 + (
    broadAccess ? 20 : 0);

    const concentrationRisk: Severity =
    score >= 60 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';

    // Longest downstream chain = cascading impact path.
    const cascadePath = [vendor.name, `${vendor.name} ${vendor.connectionType}`];
    let cursor = vendor.entryAsset;
    cascadePath.push(cursor);
    const guard = new Set<string>(cascadePath);
    for (let i = 0; i < 6; i += 1) {
      const nextEdge = graph.edges.
      filter((e) => e.from === cursor && e.kind === 'DEPENDS_ON' && !guard.has(e.to)).
      sort((a, b) => {
        const ca = assetByName.get(a.to)?.criticality === 'Critical' ? 0 : 1;
        const cb = assetByName.get(b.to)?.criticality === 'Critical' ? 0 : 1;
        return ca - cb;
      })[0];
      if (!nextEdge) break;
      cascadePath.push(nextEdge.to);
      guard.add(nextEdge.to);
      cursor = nextEdge.to;
    }

    return {
      vendor,
      directDependencies: direct,
      indirectDependencies: indirect,
      dependentSystems: reach.length,
      criticalAssets,
      sensitiveAssets,
      connections: vendor.connections.length,
      concentrationRisk,
      cascadePath,
      singlePointOfFailure: criticalAssets.length > 0 && vendor.connections.length === 1,
      score
    };
  });

  return risks.sort((a, b) => b.score - a.score);
}

export function concentrationByAsset(
vendors: ThirdPartyVendor[],
assets: Asset[],
assetEdges: DependencyEdge[])
: {asset: string;vendors: number;criticality: Asset['criticality'];}[] {
  const graph = buildDependencyGraph(vendors, assets, assetEdges);
  return assets.
  map((asset) => ({
    asset: asset.name,
    criticality: asset.criticality,
    vendors: vendors.filter((v) => downstream(graph, v.name).some((d) => d.node === asset.name)).
    length
  })).
  filter((row) => row.vendors > 0).
  sort((a, b) => b.vendors - a.vendors);
}