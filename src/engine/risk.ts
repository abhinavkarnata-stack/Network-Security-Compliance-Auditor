import type { DriftEvent, Finding, RiskScores, Severity } from '../types/nexus';
import type { VendorRisk } from './dependencies';

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 10,
  HIGH: 7,
  MEDIUM: 4,
  LOW: 2
};

export interface RiskInputs {
  findings: Finding[];
  complianceScore: number;
  exposedFlows: number;
  totalFlows: number;
  sensitiveAssetExposures: number;
  vendorRisks: VendorRisk[];
  driftEvents: DriftEvent[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Deterministic risk model — no AI involvement. */
export function calculateRisk(inputs: RiskInputs): RiskScores {
  const { findings, complianceScore, exposedFlows, totalFlows, sensitiveAssetExposures } = inputs;

  const open = findings.filter((f) => f.status !== 'Resolved');
  const criticals = open.filter((f) => f.severity === 'CRITICAL').length;
  const highs = open.filter((f) => f.severity === 'HIGH').length;
  const mediums = open.filter((f) => f.severity === 'MEDIUM').length;

  const complianceRisk = clamp(100 - complianceScore);

  const exposureRisk = clamp(
    (totalFlows ? exposedFlows / totalFlows * 70 : 0) + sensitiveAssetExposures * 12
  );

  const thirdPartyRisk = clamp(
    inputs.vendorRisks.reduce((sum, v) => sum + v.score, 0) /
    Math.max(1, inputs.vendorRisks.length) +
    inputs.vendorRisks.filter((v) => v.concentrationRisk === 'CRITICAL').length * 10
  );

  const driftRisk = clamp(
    inputs.driftEvents.reduce((sum, d) => sum + SEVERITY_WEIGHT[d.severity] * 2.5, 0)
  );

  const penalty =
  complianceRisk * 0.18 +
  exposureRisk * 0.14 +
  thirdPartyRisk * 0.08 +
  driftRisk * 0.22 +
  criticals * 1.6 +
  highs * 0.45 +
  mediums * 0.15;

  const overall = clamp(100 - penalty);

  return {
    overall,
    compliance: complianceRisk,
    exposure: exposureRisk,
    thirdParty: thirdPartyRisk,
    drift: driftRisk,
    calculatedAt: new Date().toISOString()
  };
}

export function riskBandFor(score: number): {label: Severity;tone: string;} {
  if (score >= 85) return { label: 'LOW', tone: 'ok' };
  if (score >= 70) return { label: 'MEDIUM', tone: 'medium' };
  if (score >= 50) return { label: 'HIGH', tone: 'high' };
  return { label: 'CRITICAL', tone: 'critical' };
}

export function deviceRiskFrom(failCount: {severity: Severity;}[]): Severity {
  const pressure = failCount.reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0);
  if (pressure >= 25) return 'CRITICAL';
  if (pressure >= 14) return 'HIGH';
  if (pressure >= 6) return 'MEDIUM';
  return 'LOW';
}