import type { NetworkIntent, PolicyAction, ReachabilityHop, Zone } from '../types/nexus';
import { analyzeReachability, pathToText, type ReachabilityContext } from './reachability';

export interface IntentEvaluation {
  intent: NetworkIntent;
  expected: PolicyAction;
  actual: PolicyAction;
  compliant: boolean;
  path?: ReachabilityHop[];
  pathText: string;
  blockedBy?: string;
}

export function evaluateIntents(
intents: NetworkIntent[],
ctx: ReachabilityContext)
: IntentEvaluation[] {
  return intents.map((intent) => {
    const result = analyzeReachability(
      intent.source,
      intent.destination,
      intent.protocol,
      intent.port,
      ctx
    );
    const actual: PolicyAction = result.reachable ? 'ALLOW' : 'DENY';
    const winning = result.paths.find((p) => p.reachable) ?? result.paths[0];
    return {
      intent,
      expected: intent.action,
      actual,
      compliant: actual === intent.action,
      path: winning?.hops,
      pathText: winning ? pathToText(winning.hops) : 'no path in topology',
      blockedBy: winning?.blockedBy ?
      `${winning.blockedBy.device} — ${winning.blockedBy.ruleName}` :
      undefined
    };
  });
}

export interface SegmentationCell {
  source: Zone;
  destination: Zone;
  intended: PolicyAction | 'unspecified';
  actual: PolicyAction;
  violation: boolean;
}

const SEGMENTATION_ZONES: Zone[] = [
'Internet',
'DMZ',
'Application',
'Database',
'Management',
'Vendor',
'Cloud'];


/**
 * Zone-to-zone segmentation matrix. Uses the intent set as the source of truth
 * where an intent exists, and flags any cross-zone flow that contradicts it.
 */
export function analyzeSegmentation(
intents: NetworkIntent[],
ctx: ReachabilityContext)
: SegmentationCell[] {
  const cells: SegmentationCell[] = [];
  SEGMENTATION_ZONES.forEach((source) => {
    SEGMENTATION_ZONES.forEach((destination) => {
      if (source === destination) return;
      const intent = intents.find((i) => i.source === source && i.destination === destination);
      const probePort = intent?.port ?? (destination === 'Database' ? '3306' : '443');
      const probeProto = intent?.protocol ?? 'tcp';
      const result = analyzeReachability(source, destination, probeProto, probePort, ctx);
      const actual: PolicyAction = result.reachable ? 'ALLOW' : 'DENY';
      cells.push({
        source,
        destination,
        intended: intent ? intent.action : 'unspecified',
        actual,
        violation: intent ? actual !== intent.action : false
      });
    });
  });
  return cells;
}