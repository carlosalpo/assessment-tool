export type DataGapSubject = "neighbor_coverage" | "performance_metrics" | "monitoring_gap" | "parsing_artifact";

type GapGroup = {
  subject: DataGapSubject;
  findings: any[];
};

const subjectOrder: DataGapSubject[] = [
  "neighbor_coverage",
  "performance_metrics",
  "monitoring_gap",
  "parsing_artifact"
];

const subjectLabels: Record<DataGapSubject, string> = {
  neighbor_coverage: "cobertura de vecinos CDP/LLDP",
  performance_metrics: "metricas de performance",
  monitoring_gap: "monitoreo o visibilidad",
  parsing_artifact: "validacion confiable de vecinos parseados"
};

export function isGapConsolidationEnabled() {
  return process.env.AI_GAP_CONSOLIDATION === "1";
}

export function dataGapSubject(finding: any): DataGapSubject | null {
  if (isCompositeFinding(finding)) return null;
  const text = normalizedText([
    finding?.title,
    finding?.technical_rationale,
    finding?.business_impact,
    finding?.recommendation
  ].join(" "));

  if (!text) return null;

  if (/\bautoreferenciad\w*\b/.test(text) || /\bself[-\s]?neighbor\b/.test(text)) return "parsing_artifact";

  if (
    /\bneighbor coverage\b/.test(text) ||
    /\bcobertura de vecinos\b/.test(text) ||
    /\bbaja cobertura\b/.test(text) ||
    (/\b(cdp|lldp)\b/.test(text) && hasGapIndicator(text))
  ) {
    return "neighbor_coverage";
  }

  if (
    /\bperformance metrics\b/.test(text) ||
    /\bhistorical performance data\b/.test(text) ||
    /\bmetricas? (de )?(rendimiento|performance)\b/.test(text) ||
    /\bsin metricas\b/.test(text) ||
    (/\b(rendimiento|performance)\b/.test(text) && hasGapIndicator(text))
  ) {
    return "performance_metrics";
  }

  if (
    /\bvisibilidad faltante\b/.test(text) ||
    /\bfalta (de )?visibilidad\b/.test(text) ||
    /\bsin monitoreo\b/.test(text) ||
    /\bmissing monitoring\b/.test(text) ||
    /\bmonitoring gap\b/.test(text) ||
    (/\b(monitoreo|monitoring|visibilidad)\b/.test(text) && hasGapIndicator(text))
  ) {
    return "monitoring_gap";
  }

  return null;
}

export function normalizeGapFindings(findings: any[]) {
  return safeArray(findings).map((finding) => {
    if (!dataGapSubject(finding)) return finding;
    return {
      ...finding,
      finding_type: "visibility_gap",
      severity: "low"
    };
  });
}

export function consolidateGapFindings(findings: any[]) {
  const nonGapFindings: any[] = [];
  const groups = new Map<DataGapSubject, GapGroup>();

  for (const finding of safeArray(findings)) {
    const subject = dataGapSubject(finding);
    if (!subject) {
      nonGapFindings.push(finding);
      continue;
    }
    const group = groups.get(subject) ?? { subject, findings: [] };
    group.findings.push(finding);
    groups.set(subject, group);
  }

  const consolidated = subjectOrder
    .map((subject) => groups.get(subject))
    .filter(Boolean)
    .map((group) => buildConsolidatedFinding(group as GapGroup));

  return [...nonGapFindings, ...consolidated];
}

function buildConsolidatedFinding(group: GapGroup) {
  const findings = group.findings;
  const first = findings[0] ?? {};
  const relatedDevices = uniqueStrings(findings.flatMap((finding) => [
    ...safeStringArray(finding?.related_devices),
    ...safeStringArray(finding?.affectedAssets),
    ...safeStringArray(finding?.devices)
  ])).sort(compareStable);
  const evidenceRefs = uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.evidence_refs))).sort(compareStable).slice(0, 12);
  const evidence = uniqueEvidence(findings.flatMap((finding) => Array.isArray(finding?.evidence) ? finding.evidence : [])).slice(0, 6);
  const relatedFactIds = uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.related_fact_ids))).sort(compareStable).slice(0, 12);
  const relatedMetricIds = uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.related_metric_ids))).sort(compareStable).slice(0, 12);
  const relatedCorrelationIds = uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.related_correlation_ids))).sort(compareStable).slice(0, 12);
  const count = relatedDevices.length || findings.length;
  const scope = String(first?.scope ?? first?.scopeId ?? "").trim();
  const deviceLabel = count === 1 ? "equipo" : "equipos";
  const title = `${count} ${deviceLabel} sin ${subjectLabels[group.subject]} (limitacion de recoleccion)`;
  const deviceSummary = relatedDevices.length > 0 ? relatedDevices.join(", ") : "sin equipos explicitamente relacionados";

  return {
    ...first,
    finding_id: `gap_${scope ? `${sanitizeId(scope)}_` : ""}${group.subject}`,
    scope: scope || first?.scope,
    title,
    finding_type: "visibility_gap",
    severity: "low",
    confidence: first?.confidence ?? "medium",
    evidence_refs: evidenceRefs,
    related_fact_ids: relatedFactIds,
    related_metric_ids: relatedMetricIds,
    related_correlation_ids: relatedCorrelationIds,
    evidence,
    technical_rationale: `Consolidado de ${findings.length} hallazgos de brecha de datos sobre ${subjectLabels[group.subject]}. Equipos afectados: ${deviceSummary}.`,
    business_impact: "La limitacion de datos reduce la confianza del assessment y puede ocultar riesgos reales, pero no confirma por si sola un problema del cliente.",
    recommendation: `Recolectar evidencia faltante de ${subjectLabels[group.subject]} para los equipos afectados y volver a ejecutar la evaluacion.`,
    remediation_category: "operational_change",
    remediation_steps: uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.remediation_steps))).slice(0, 6),
    validation_questions: uniqueStrings([
      ...findings.flatMap((finding) => safeStringArray(finding?.validation_questions)),
      "Confirmar si la brecha proviene de alcance de recoleccion, permisos, comandos omitidos o parsing."
    ]).slice(0, 6),
    related_devices: relatedDevices,
    related_sites: uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.related_sites))).sort(compareStable),
    dependencies: uniqueStrings(findings.flatMap((finding) => safeStringArray(finding?.dependencies))).slice(0, 8)
  };
}

function hasGapIndicator(text: string) {
  return /\b(falta|faltan|faltante|insuficient\w*|sin|missing|lack|lacks|no se encontro|no hay|ausencia|gap|brecha|cobertura|coverage|visibilidad|recoleccion)\b/.test(text);
}

function isCompositeFinding(finding: any) {
  const scope = String(finding?.scope ?? finding?.scopeId ?? "");
  const findingType = String(finding?.finding_type ?? "");
  return scope === "cross_scope_correlation" || findingType === "cross_scope_correlation";
}

function normalizedText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueEvidence(items: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const item of items) {
    const key = stableStringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function safeArray(value: any[]) {
  return Array.isArray(value) ? value : [];
}

function safeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

function compareStable(left: string, right: string) {
  return left.localeCompare(right, "en");
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
