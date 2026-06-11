import type { Finding, ImpactIfFails, ProbabilityOfFailure, RiskLevel } from "./types.ts";

const probabilityWeights: Record<ProbabilityOfFailure, number> = {
  very_likely: 5,
  likely: 4,
  possible: 3,
  unlikely: 2,
  very_unlikely: 1
};

const impactWeights: Record<ImpactIfFails, number> = {
  severe: 5,
  significant: 4,
  moderate: 3,
  minor: 2,
  negligible: 1
};

export function deriveFindingRisk(
  probabilityOfFailure: NonNullable<Finding["probabilityOfFailure"]>,
  impactIfFails: NonNullable<Finding["impactIfFails"]>
): RiskLevel {
  const score = probabilityWeights[probabilityOfFailure] * impactWeights[impactIfFails];
  if (score >= 16) return "critical";
  if (score >= 12) return "high";
  if (score >= 8) return "medium";
  if (score >= 4) return "low";
  return "info";
}
