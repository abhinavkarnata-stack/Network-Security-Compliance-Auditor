import type {
  NormalizedConfig,
  PolicyAction,
  PolicyRule,
  Protocol,
  ReachabilityHop,
  ReachabilityResult,
  TopologyEdgeDef,
  Zone } from
'../types/nexus';

export interface ReachabilityContext {
  edges: TopologyEdgeDef[];
  configsByDevice: Record<string, NormalizedConfig>;
}

function zoneMatch(ruleZone: Zone | 'any', hopZone: Zone, flowZone: Zone): boolean {
  return ruleZone === 'any' || ruleZone === hopZone || ruleZone === flowZone;
}

function portMatch(rulePorts: string, port: string): boolean {
  if (rulePorts === 'any' || !rulePorts) return true;
  if (rulePorts.includes('-')) {
    const [lo, hi] = rulePorts.split('-').map((p) => parseInt(p, 10));
    const p = parseInt(port, 10);
    return p >= lo && p <= hi;
  }
  return rulePorts === port;
}

function protoMatch(ruleProto: Protocol, proto: Protocol): boolean {
  return ruleProto === 'any' || proto === 'any' || ruleProto === proto;
}

export interface HopDecision {
  action: PolicyAction;
  rule?: PolicyRule;
  device: string;
}

/** First-match policy evaluation on the guarding device for one zone crossing. */
export function evaluateHop(
cfg: NormalizedConfig | undefined,
device: string,
hopSrc: Zone,
hopDst: Zone,
flowSrc: Zone,
flowDst: Zone,
protocol: Protocol,
port: string)
: HopDecision {
  if (!cfg) return { action: 'DENY', device };
  const rules = [...cfg.firewallRules].filter((r) => r.enabled).sort((a, b) => a.seq - b.seq);
  for (const rule of rules) {
    if (
    zoneMatch(rule.srcZone, hopSrc, flowSrc) &&
    zoneMatch(rule.dstZone, hopDst, flowDst) &&
    protoMatch(rule.protocol, protocol) &&
    portMatch(rule.ports, port))
    {
      return { action: rule.action, rule, device };
    }
  }
  return { action: 'DENY', device };
}

function zonePaths(edges: TopologyEdgeDef[], source: Zone, destination: Zone, maxDepth = 5) {
  const adjacency = new Map<Zone, {zone: Zone;guard: string;}[]>();
  edges.forEach((e) => {
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), { zone: e.to, guard: e.guard }]);
    adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), { zone: e.from, guard: e.guard }]);
  });

  const results: {zone: Zone;guard: string;}[][] = [];
  const walk = (current: Zone, trail: {zone: Zone;guard: string;}[], seen: Set<Zone>) => {
    if (trail.length > maxDepth) return;
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next.zone)) continue;
      const nextTrail = [...trail, next];
      if (next.zone === destination) {
        results.push(nextTrail);
        continue;
      }
      walk(next.zone, nextTrail, new Set([...seen, next.zone]));
    }
  };
  walk(source, [], new Set([source]));
  return results.sort((a, b) => a.length - b.length).slice(0, 6);
}

export function analyzeReachability(
source: Zone,
destination: Zone,
protocol: Protocol,
port: string,
ctx: ReachabilityContext)
: ReachabilityResult {
  const candidates = zonePaths(ctx.edges, source, destination);
  const paths: ReachabilityResult['paths'] = [];

  for (const candidate of candidates) {
    const hops: ReachabilityHop[] = [{ node: source }];
    let blockedBy: ReachabilityHop | undefined;
    let cursor: Zone = source;
    let lastDevice = '';

    for (const step of candidate) {
      const decision = evaluateHop(
        ctx.configsByDevice[step.guard],
        step.guard,
        cursor,
        step.zone,
        source,
        destination,
        protocol,
        port
      );
      const deviceHop: ReachabilityHop = {
        node: step.guard,
        device: step.guard,
        ruleName: decision.rule?.name ?? 'implicit deny (no matching rule)',
        decision: decision.action
      };
      if (step.guard !== lastDevice) {
        hops.push(deviceHop);
        lastDevice = step.guard;
      } else {
        const prev = hops[hops.length - 1];
        if (prev.device === step.guard && decision.action === 'DENY') {
          prev.decision = 'DENY';
          prev.ruleName = deviceHop.ruleName;
        }
      }
      if (decision.action === 'DENY') {
        blockedBy = deviceHop;
        hops.push({ node: step.zone });
        break;
      }
      hops.push({ node: step.zone });
      cursor = step.zone;
    }

    paths.push({ hops, reachable: !blockedBy, blockedBy });
  }

  const reachablePaths = paths.filter((p) => p.reachable);
  const reachable = reachablePaths.length > 0;
  const shortest = reachablePaths[0];
  return {
    source,
    destination,
    protocol,
    port,
    reachable,
    kind: reachable ?
    shortest && shortest.hops.filter((h) => h.device).length <= 1 ?
    'direct' :
    'indirect' :
    'blocked',
    paths: paths.sort((a, b) => Number(b.reachable) - Number(a.reachable))
  };
}

export function pathToText(hops: ReachabilityHop[]): string {
  return hops.map((h) => h.node).join(' → ');
}