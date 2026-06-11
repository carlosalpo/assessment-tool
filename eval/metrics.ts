import { matchesSignature, type GoldenSignature, type ProducedFinding } from "./matching.ts";
import { isVacuousRemediation } from "../lib/remediation-quality.ts";

export type ScopeGolden = {
  fixtureId: string;
  scopeId: string;
  mustFind: GoldenSignature[];
  mustNotFind: GoldenSignature[];
};

export type ScopeMetrics = {
  fixtureId: string;
  scopeId: string;
  produced: number;
  precision: number;
  recall: number;
  coverage: number;
  vacuousRemediationCount: number;
  missing: GoldenSignature[];
  leaked: GoldenSignature[];
  matchedFindingIds: string[];
};

export function evaluateScope(golden: ScopeGolden, produced: ProducedFinding[]): ScopeMetrics {
  const expectedMatches = golden.mustFind.map((signature) => ({
    signature,
    finding: produced.find((finding) => matchesSignature(finding, signature))
  }));
  const missing = expectedMatches.filter((item) => !item.finding).map((item) => item.signature);
  const matchedIds = new Set(expectedMatches.map((item) => item.finding?.finding_id).filter(Boolean) as string[]);
  const leaked = golden.mustNotFind.filter((signature) => produced.some((finding) => matchesSignature(finding, signature, { keywordThreshold: 1, deviceThreshold: 1 })));
  const vacuousRemediationCount = produced.filter(hasVacuousActionableRemediation).length;
  const precision = golden.mustFind.length === 0 ? 1 : produced.length === 0 ? 0 : matchedIds.size / produced.length;
  const recall = golden.mustFind.length === 0 ? 1 : (golden.mustFind.length - missing.length) / golden.mustFind.length;

  return {
    fixtureId: golden.fixtureId,
    scopeId: golden.scopeId,
    produced: produced.length,
    precision,
    recall,
    coverage: recall,
    vacuousRemediationCount,
    missing,
    leaked,
    matchedFindingIds: Array.from(matchedIds)
  };
}

function hasVacuousActionableRemediation(finding: ProducedFinding) {
  const findingType = String(finding.finding_type ?? "");
  if (findingType === "visibility_gap" || findingType === "validation_required") return false;
  if (!Object.prototype.hasOwnProperty.call(finding, "recommendation")) return false;
  return isVacuousRemediation(finding.recommendation);
}

export function aggregateMetrics(metrics: ScopeMetrics[]) {
  const produced = metrics.reduce((sum, item) => sum + item.produced, 0);
  const mustFind = metrics.reduce((sum, item) => sum + item.missing.length + item.matchedFindingIds.length, 0);
  const missing = metrics.flatMap((item) => item.missing);
  const leaked = metrics.flatMap((item) => item.leaked);
  const vacuousRemediationCount = metrics.reduce((sum, item) => sum + item.vacuousRemediationCount, 0);
  return {
    produced,
    precision: metrics.length === 0 ? 1 : metrics.reduce((sum, item) => sum + item.precision, 0) / metrics.length,
    recall: mustFind === 0 ? 1 : (mustFind - missing.length) / mustFind,
    coverage: mustFind === 0 ? 1 : (mustFind - missing.length) / mustFind,
    vacuousRemediationCount,
    missing,
    leaked
  };
}
