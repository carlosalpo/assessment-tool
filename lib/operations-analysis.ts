import {
  operationalDomainLabels,
  operationalQuestionBank,
  type OperationalAssessment,
  type OperationalDomain,
  type OperationalFinding
} from "./operational-assessment.ts";
import type { RemediationCategory } from "./types.ts";

export type OperationsFinding = {
  id: string;
  area: OperationalDomain | "overall";
  dimension: string;
  gap: string;
  status: "detected";
  severity: OperationalFinding["severity"];
  remediationCategory: RemediationCategory;
  confidence: number;
  evidence: string[];
  relatedQuestions: string[];
  relatedAnswers: string[];
  technical_rationale: string;
  business_impact: string;
  recommendation: string;
};

const completeStatuses = new Set(["completed", "ai_reviewed", "validated"]);

export function isOperationalAssessmentComplete(assessment: OperationalAssessment | undefined | null) {
  if (!assessment) return false;
  if (!completeStatuses.has(assessment.status)) return false;
  if (!Array.isArray(assessment.interviews) || assessment.interviews.length === 0) return false;
  const answersByQuestion = new Map((assessment.answers ?? []).map((answer) => [answer.questionId, answer]));
  return operationalQuestionBank
    .filter((question) => question.required)
    .every((question) => {
      const answer = answersByQuestion.get(question.id);
      if (!answer) return false;
      if (answer.value === null || answer.value === "") return false;
      if (Array.isArray(answer.value) && answer.value.length === 0) return false;
      return true;
    });
}

export function buildOperationsFindings(assessment: OperationalAssessment | undefined | null): OperationsFinding[] {
  if (!isOperationalAssessmentComplete(assessment)) return [];
  const completeAssessment = assessment as OperationalAssessment;
  const findings: OperationsFinding[] = [];
  const domains = [...completeAssessment.domains].sort((left, right) => left.domain.localeCompare(right.domain));

  for (const domain of domains) {
    const gaps = domain.gaps.length > 0
      ? domain.gaps
      : domain.score < 3
        ? [`Madurez ${domain.maturityLevel.toLowerCase()} (${domain.score}/5)`]
        : [];
    if (domain.score >= 3 && gaps.length === 0 && domain.riskContribution < 50) continue;

    const gap = gaps[0] ?? `Riesgo operacional ${domain.riskContribution}/100`;
    const severity = severityForOperationsDomain(domain.score, domain.riskContribution, gap);
    findings.push({
      id: `operations_${stableId(`${completeAssessment.assessmentId}:${domain.domain}:${gap}`)}`,
      area: domain.domain,
      dimension: operationalDomainLabels[domain.domain],
      gap,
      status: "detected",
      severity,
      remediationCategory: remediationCategoryForOperations(domain.domain, severity),
      confidence: confidenceForOperations(domain.confidence),
      evidence: operationEvidenceLines(domain.domain, gap, domain.relatedQuestions, domain.relatedAnswers),
      relatedQuestions: domain.relatedQuestions.slice(0, 12),
      relatedAnswers: domain.relatedAnswers.slice(0, 12),
      technical_rationale: `La dimension ${operationalDomainLabels[domain.domain]} obtuvo madurez ${domain.score}/5 (${domain.maturityLevel}) y riesgo ${domain.riskContribution}/100.`,
      business_impact: businessImpactForOperations(domain.domain, severity),
      recommendation: domain.recommendedActions[0] ?? recommendationForOperations(domain.domain)
    });
  }

  if (completeAssessment.operationalRiskScore >= 70) {
    findings.push({
      id: `operations_${stableId(`${completeAssessment.assessmentId}:overall:${completeAssessment.operationalRiskScore}`)}`,
      area: "overall",
      dimension: "Riesgo operacional agregado",
      gap: `Riesgo operacional ${completeAssessment.operationalRiskScore}/100 con madurez global ${completeAssessment.overallMaturityScore}/5`,
      status: "detected",
      severity: completeAssessment.operationalRiskScore >= 85 ? "critical" : "high",
      remediationCategory: "operational_change",
      confidence: confidenceForOperations(completeAssessment.confidenceScore),
      evidence: [
        `overallMaturityScore=${completeAssessment.overallMaturityScore}`,
        `operationalRiskScore=${completeAssessment.operationalRiskScore}`,
        `confidenceScore=${completeAssessment.confidenceScore}`,
        ...completeAssessment.keyGaps.slice(0, 3)
      ],
      relatedQuestions: [],
      relatedAnswers: [],
      technical_rationale: `El scoring del Tab 11 clasifica el riesgo operacional agregado en ${completeAssessment.operationalRiskScore}/100 con madurez ${completeAssessment.overallMaturityScore}/5.`,
      business_impact: "La debilidad operacional transversal aumenta la probabilidad de incidentes prolongados, cambios fallidos y baja trazabilidad ejecutiva.",
      recommendation: completeAssessment.recommendedActions[0] ?? "Priorizar un plan de mejora operacional con responsables, evidencias, KPIs y seguimiento ejecutivo."
    });
  }

  if (findings.length === 0 && completeAssessment.keyGaps.length > 0) {
    for (const gap of completeAssessment.keyGaps.slice(0, 5).sort()) {
      findings.push({
        id: `operations_${stableId(`${completeAssessment.assessmentId}:gap:${gap}`)}`,
        area: "overall",
        dimension: "Brecha operacional",
        gap,
        status: "detected",
        severity: "medium",
        remediationCategory: "operational_change",
        confidence: confidenceForOperations(completeAssessment.confidenceScore),
        evidence: [gap],
        relatedQuestions: [],
        relatedAnswers: [],
        technical_rationale: `La brecha "${gap}" fue identificada en el resumen operacional del Tab 11.`,
        business_impact: "La brecha puede limitar trazabilidad, eficiencia operativa y capacidad de respuesta ante incidentes.",
        recommendation: "Asignar responsable, evidencia esperada y fecha objetivo para cerrar la brecha operacional."
      });
    }
  }

  return findings.sort((left, right) =>
    severityRank(right.severity) - severityRank(left.severity) ||
    left.dimension.localeCompare(right.dimension) ||
    left.id.localeCompare(right.id)
  );
}

export function applyOperationsNarration(findings: OperationsFinding[], narrations: any[]) {
  const narrationById = new Map((Array.isArray(narrations) ? narrations : []).map((item) => [String(item?.finding_id ?? item?.id ?? ""), item]));
  return findings.map((finding) => {
    const narration = narrationById.get(finding.id);
    if (!narration) return finding;
    return {
      ...finding,
      technical_rationale: boundedNarrationText(narration.technical_rationale, finding.technical_rationale),
      business_impact: boundedNarrationText(narration.business_impact, finding.business_impact),
      recommendation: boundedNarrationText(narration.recommendation, finding.recommendation)
    };
  });
}

function severityForOperationsDomain(score: number, riskContribution: number, gap: string): OperationalFinding["severity"] {
  if (score < 1 || riskContribution >= 85 || /critica|critico|sin respuesta/i.test(gap)) return "critical";
  if (score < 2 || riskContribution >= 70 || /insuficiente|falta|no existe/i.test(gap)) return "high";
  if (score < 3 || riskContribution >= 50) return "medium";
  return "low";
}

function remediationCategoryForOperations(domain: OperationalDomain, severity: OperationalFinding["severity"]): RemediationCategory {
  if (domain === "automation_improvement" && (severity === "high" || severity === "critical")) return "new_technology";
  if (domain === "capacity_performance" && severity === "critical") return "new_technology";
  return "operational_change";
}

function confidenceForOperations(confidenceScore: number) {
  if (confidenceScore >= 75) return 90;
  if (confidenceScore >= 50) return 75;
  return 60;
}

function operationEvidenceLines(domain: OperationalDomain, gap: string, relatedQuestions: string[], relatedAnswers: string[]) {
  return [
    `dimension=${operationalDomainLabels[domain]}`,
    `gap=${gap}`,
    `relatedQuestions=${relatedQuestions.slice(0, 8).join(",")}`,
    `relatedAnswers=${relatedAnswers.slice(0, 8).join(",")}`
  ];
}

function businessImpactForOperations(domain: OperationalDomain, severity: OperationalFinding["severity"]) {
  const prefix = severity === "critical" || severity === "high"
    ? "Puede elevar materialmente"
    : "Puede incrementar";
  return `${prefix} el riesgo de indisponibilidad, tiempos de recuperacion extendidos y baja trazabilidad en ${operationalDomainLabels[domain]}.`;
}

function recommendationForOperations(domain: OperationalDomain) {
  return `Formalizar proceso, responsables, evidencia y metricas recurrentes para ${operationalDomainLabels[domain]}.`;
}

function severityRank(severity: OperationalFinding["severity"]) {
  const rank: Record<OperationalFinding["severity"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  return rank[severity];
}

function boundedNarrationText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 1600) : fallback;
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
