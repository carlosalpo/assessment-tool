import { matchesSignature, type GoldenSignature, type ProducedFinding } from "./matching.ts";

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
  const precision = golden.mustFind.length === 0 ? 1 : produced.length === 0 ? 0 : matchedIds.size / produced.length;
  const recall = golden.mustFind.length === 0 ? 1 : (golden.mustFind.length - missing.length) / golden.mustFind.length;

  return {
    fixtureId: golden.fixtureId,
    scopeId: golden.scopeId,
    produced: produced.length,
    precision,
    recall,
    coverage: recall,
    missing,
    leaked,
    matchedFindingIds: Array.from(matchedIds)
  };
}

export function aggregateMetrics(metrics: ScopeMetrics[]) {
  const produced = metrics.reduce((sum, item) => sum + item.produced, 0);
  const mustFind = metrics.reduce((sum, item) => sum + item.missing.length + item.matchedFindingIds.length, 0);
  const missing = metrics.flatMap((item) => item.missing);
  const leaked = metrics.flatMap((item) => item.leaked);
  return {
    produced,
    precision: metrics.length === 0 ? 1 : metrics.reduce((sum, item) => sum + item.precision, 0) / metrics.length,
    recall: mustFind === 0 ? 1 : (mustFind - missing.length) / mustFind,
    coverage: mustFind === 0 ? 1 : (mustFind - missing.length) / mustFind,
    missing,
    leaked
  };
}
