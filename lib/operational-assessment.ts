import { uid } from "./utils.ts";
import type { RemediationCategory } from "./types.ts";

export type OperationalAssessmentStatus = "draft" | "in_progress" | "completed" | "ai_reviewed" | "validated";
export type OperationalInterviewType =
  | "it_management"
  | "network_operations"
  | "network_architecture"
  | "security_operations"
  | "datacenter_operations"
  | "service_desk"
  | "continuity_dr"
  | "lifecycle_contracts";
export type OperationalResponseType =
  | "boolean"
  | "single_select"
  | "multi_select"
  | "maturity_0_5"
  | "percentage"
  | "number"
  | "frequency"
  | "duration"
  | "text"
  | "evidence_upload";
export type OperationalEvidenceLevel = "none" | "self_declared" | "documented" | "tool_export" | "validated";
export type OperationalRemediationCategory = RemediationCategory;
export type OperationalFindingStatus = "draft" | "validated" | "discarded";
export type OperationalDomain =
  | "governance"
  | "inventory_documentation"
  | "monitoring"
  | "incidents"
  | "change_management"
  | "backup_config"
  | "lifecycle_support"
  | "capacity_performance"
  | "continuity_dr"
  | "automation_improvement";

export type ScoringRule = {
  method: "direct_0_5" | "boolean_positive" | "boolean_negative" | "percentage_to_score" | "frequency_to_score" | "weighted_options" | "coverage_ratio";
  weight: number;
  minimumEvidenceLevel: OperationalEvidenceLevel;
  unknownBehavior: "penalize" | "exclude_from_score" | "mark_insufficient_evidence";
};

export type OperationalInterview = {
  id: string;
  assessmentId: string;
  interviewType: OperationalInterviewType;
  participants: string;
  date: string;
  durationMinutes: number;
  interviewer: string;
  notes: string;
};

export type OperationalQuestion = {
  id: string;
  domain: OperationalDomain;
  category: string;
  question: string;
  helpText: string;
  responseType: OperationalResponseType;
  required: boolean;
  critical?: boolean;
  options?: Array<{ label: string; value: string; score?: number }>;
  scoring: ScoringRule;
  evidenceRequired: boolean;
  evidenceTypes: string[];
  impacts: {
    riskDimensions: string[];
    confidenceDimensions: string[];
  };
  aiContextTag: string;
};

export type OperationalAnswer = {
  id: string;
  questionId: string;
  interviewId: string;
  assessmentId: string;
  value: string | number | boolean | string[] | null;
  score: number | null;
  evidenceLevel: OperationalEvidenceLevel;
  evidenceFiles: string[];
  comments: string;
  answeredBy: string;
  reviewedByArchitect: boolean;
};

export type OperationalDomainScore = {
  domain: OperationalDomain;
  score: number;
  maturityLevel: string;
  riskContribution: number;
  confidence: number;
  strengths: string[];
  gaps: string[];
  recommendedActions: string[];
  relatedQuestions: string[];
  relatedAnswers: string[];
  missingRequiredQuestions: string[];
  insufficientEvidenceQuestions: string[];
};

export type OperationalFinding = {
  id: string;
  assessmentId: string;
  domain: OperationalDomain;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  evidence: string[];
  affectedCapabilities: string[];
  businessImpact: string;
  technicalImpact: string;
  recommendation: string;
  remediationCategory: OperationalRemediationCategory;
  relatedQuestions: string[];
  relatedAnswers: string[];
  status: OperationalFindingStatus;
};

export type OperationalExecutiveSummary = {
  assessmentId: string;
  overallMaturityScore: number;
  operationalRiskScore: number;
  confidenceScore: number;
  maturityLevel: string;
  summaryText: string;
  keyStrengths: string[];
  keyGaps: string[];
  topRisks: string[];
  recommendedActions: string[];
  impactOnRiskIndex: string;
  impactOnConfidenceIndex: string;
  validationStatus: OperationalAssessmentStatus;
  lastUpdated: string;
};

export type OperationalAssessment = {
  id: string;
  assessmentId: string;
  customerId: string;
  status: OperationalAssessmentStatus;
  interviews: OperationalInterview[];
  answers: OperationalAnswer[];
  domains: OperationalDomainScore[];
  findings: OperationalFinding[];
  overallMaturityScore: number;
  operationalRiskScore: number;
  confidenceScore: number;
  aiSummary: string;
  executiveSummaryText: string;
  keyStrengths: string[];
  keyGaps: string[];
  topOperationalRisks: string[];
  recommendedActions: string[];
  executiveSummary?: OperationalExecutiveSummary;
  createdAt: string;
  updatedAt: string;
};

export const operationalDomainLabels: Record<OperationalDomain, string> = {
  governance: "Gobierno operativo",
  inventory_documentation: "Inventario y documentacion",
  monitoring: "Monitoreo y observabilidad",
  incidents: "Incidentes y troubleshooting",
  change_management: "Gestion de cambios",
  backup_config: "Backups y control de configuracion",
  lifecycle_support: "Vulnerabilidades, lifecycle y soporte",
  capacity_performance: "Capacidad y performance",
  continuity_dr: "Continuidad, resiliencia y DR",
  automation_improvement: "Herramientas, automatizacion y mejora continua"
};

export const operationalScoringConfig = {
  evidenceLevelScore: {
    none: 0,
    self_declared: 2,
    documented: 3.5,
    tool_export: 4.5,
    validated: 5
  } satisfies Record<OperationalEvidenceLevel, number>,
  confidenceWeights: {
    answeredRatio: 45,
    evidenceRatio: 35,
    criticalAnsweredRatio: 20
  },
  riskAdjustments: {
    lowDomainScore: 5,
    backupWeakness: 8,
    monitoringWeakness: 8,
    incidentProcessMissing: 6,
    changeProcessMissing: 6,
    lifecycleControlMissing: 5,
    insufficientEvidenceCritical: 4
  },
  evidenceScoreCapWhenInsufficient: 2
};

const defaultScoring = (method: ScoringRule["method"] = "boolean_positive", weight = 1, minimumEvidenceLevel: OperationalEvidenceLevel = "self_declared"): ScoringRule => ({
  method,
  weight,
  minimumEvidenceLevel,
  unknownBehavior: "mark_insufficient_evidence"
});

function q(
  id: string,
  domain: OperationalDomain,
  question: string,
  responseType: OperationalResponseType = "boolean",
  critical = false,
  scoring: ScoringRule = defaultScoring()
): OperationalQuestion {
  const effectiveScoring =
    critical && scoring.minimumEvidenceLevel === "self_declared"
      ? { ...scoring, minimumEvidenceLevel: "documented" as OperationalEvidenceLevel }
      : scoring;
  return {
    id,
    domain,
    category: operationalDomainLabels[domain],
    question,
    helpText: critical ? "Pregunta critica para determinar madurez y riesgo operativo." : "Respuesta deterministica para calcular madurez operativa.",
    responseType,
    required: true,
    critical,
    options: responseType === "frequency" ? frequencyOptions : responseType === "maturity_0_5" ? maturityOptions : undefined,
    scoring: effectiveScoring,
    evidenceRequired: critical,
    evidenceTypes: ["documento", "captura", "export de herramienta", "ticket"],
    impacts: {
      riskDimensions: domainRiskDimensions(domain),
      confidenceDimensions: ["interview_completion", "operational_evidence"]
    },
    aiContextTag: `${domain}:${id}`
  };
}

const maturityOptions = [0, 1, 2, 3, 4, 5].map((value) => ({ label: `${value}`, value: String(value), score: value }));
const frequencyOptions = [
  { label: "Nunca", value: "never", score: 0 },
  { label: "Ad hoc", value: "ad_hoc", score: 1 },
  { label: "Anual", value: "yearly", score: 2 },
  { label: "Trimestral", value: "quarterly", score: 3 },
  { label: "Mensual", value: "monthly", score: 4 },
  { label: "Continuo", value: "continuous", score: 5 }
];

export const operationalQuestionBank: OperationalQuestion[] = [
  q("GOV-01", "governance", "Existe un responsable formal de la operacion de red?", "boolean", true),
  q("GOV-02", "governance", "Existen roles documentados para operacion, escalamiento y aprobacion de cambios?"),
  q("GOV-03", "governance", "La red tiene servicios criticos identificados y priorizados?", "boolean", true),
  q("GOV-04", "governance", "Existen SLAs/OLAs definidos para incidentes de red?"),
  q("GOV-05", "governance", "Se revisan periodicamente riesgos operativos de infraestructura?", "frequency", false, defaultScoring("frequency_to_score")),
  q("INV-01", "inventory_documentation", "Existe inventario actualizado de equipos de red?", "boolean", true),
  q("INV-02", "inventory_documentation", "El inventario incluye hostname, modelo, serial, version, sitio, rol y soporte?"),
  q("INV-03", "inventory_documentation", "Existe diagrama fisico actualizado?"),
  q("INV-04", "inventory_documentation", "Existe diagrama logico actualizado?"),
  q("INV-05", "inventory_documentation", "Con que frecuencia se actualiza la documentacion?", "frequency", false, defaultScoring("frequency_to_score")),
  q("MON-01", "monitoring", "Que porcentaje de equipos de red esta monitoreado?", "percentage", true, defaultScoring("percentage_to_score")),
  q("MON-02", "monitoring", "Se monitorean interfaces criticas/uplinks?"),
  q("MON-03", "monitoring", "Se recolectan logs centralizados de switches, routers y firewalls?"),
  q("MON-04", "monitoring", "Existen alertas automaticas para fallas criticas?", "boolean", true),
  q("MON-05", "monitoring", "Se monitorea disponibilidad, CPU, memoria, interfaces, errores y descartes?"),
  q("MON-06", "monitoring", "Se revisan tendencias de capacidad/performance?", "frequency", false, defaultScoring("frequency_to_score")),
  q("INC-01", "incidents", "Existe proceso formal de gestion de incidentes?", "boolean", true),
  q("INC-02", "incidents", "Los incidentes se registran en una herramienta de tickets?"),
  q("INC-03", "incidents", "Existe clasificacion por severidad e impacto?"),
  q("INC-04", "incidents", "Hay procedimiento de escalamiento tecnico?", "boolean", true),
  q("INC-05", "incidents", "Se documenta causa raiz para incidentes mayores?"),
  q("INC-06", "incidents", "Se mide MTTR?"),
  q("INC-07", "incidents", "Existen runbooks para fallas comunes?"),
  q("CHG-01", "change_management", "Existe proceso formal de cambios de red?", "boolean", true),
  q("CHG-02", "change_management", "Los cambios requieren aprobacion antes de ejecutarse?", "boolean", true),
  q("CHG-03", "change_management", "Se documenta plan de rollback?"),
  q("CHG-04", "change_management", "Se valida impacto antes del cambio?"),
  q("CHG-05", "change_management", "Se conserva evidencia del antes/despues?"),
  q("CHG-06", "change_management", "Se revisan cambios fallidos o con impacto?"),
  q("BCK-01", "backup_config", "Se realizan backups de configuracion de equipos de red?", "boolean", true),
  q("BCK-02", "backup_config", "Con que frecuencia se hacen backups?", "frequency", true, defaultScoring("frequency_to_score")),
  q("BCK-03", "backup_config", "Los backups estan versionados?"),
  q("BCK-04", "backup_config", "Se prueba restauracion de configuraciones?", "boolean", true),
  q("BCK-05", "backup_config", "Se controla drift entre configuracion esperada y real?"),
  q("BCK-06", "backup_config", "Se protegen credenciales y secretos en backups?", "boolean", true),
  q("LFC-01", "lifecycle_support", "Se revisa estado de soporte/EoX de los equipos?", "boolean", true),
  q("LFC-02", "lifecycle_support", "Se lleva control de versiones recomendadas de software?"),
  q("LFC-03", "lifecycle_support", "Se evaluan advisories de seguridad del fabricante?", "boolean", true),
  q("LFC-04", "lifecycle_support", "Existe plan de renovacion tecnologica?"),
  q("LFC-05", "lifecycle_support", "Los contratos de soporte estan identificados y vigentes?"),
  q("LFC-06", "lifecycle_support", "Existe proceso para priorizar upgrades por riesgo?"),
  q("CAP-01", "capacity_performance", "Se monitorea utilizacion de enlaces criticos?", "boolean", true),
  q("CAP-02", "capacity_performance", "Se generan reportes de tendencia de capacidad?"),
  q("CAP-03", "capacity_performance", "Existen umbrales definidos para saturacion?"),
  q("CAP-04", "capacity_performance", "Se monitorean errores, descartes y drops?", "boolean", true),
  q("CAP-05", "capacity_performance", "Se planifica crecimiento de capacidad?"),
  q("DR-01", "continuity_dr", "Estan identificados los servicios criticos dependientes de la red?", "boolean", true),
  q("DR-02", "continuity_dr", "Existen RTO/RPO definidos para servicios criticos?"),
  q("DR-03", "continuity_dr", "La red tiene procedimientos de recuperacion documentados?"),
  q("DR-04", "continuity_dr", "Se prueban escenarios de falla o failover?", "frequency", true, defaultScoring("frequency_to_score")),
  q("DR-05", "continuity_dr", "Se conocen puntos unicos de falla operativos?", "boolean", true),
  q("DR-06", "continuity_dr", "Existe personal alterno para operar la red?"),
  q("AUT-01", "automation_improvement", "Usan herramientas para automatizar tareas repetitivas de red?"),
  q("AUT-02", "automation_improvement", "Existe repositorio/versionamiento de configuraciones o scripts?"),
  q("AUT-03", "automation_improvement", "Se ejecutan validaciones automaticas antes/despues de cambios?"),
  q("AUT-04", "automation_improvement", "Se miden KPIs operativos?"),
  q("AUT-05", "automation_improvement", "Existe proceso de mejora continua?")
];

export function createDefaultOperationalAssessment(assessmentId: string, customerId: string): OperationalAssessment {
  const now = new Date().toISOString();
  return {
    id: uid("ops"),
    assessmentId,
    customerId,
    status: "draft",
    interviews: [],
    answers: [],
    domains: [],
    findings: [],
    overallMaturityScore: 0,
    operationalRiskScore: 0,
    confidenceScore: 0,
    aiSummary: "",
    executiveSummaryText: "",
    keyStrengths: [],
    keyGaps: [],
    topOperationalRisks: [],
    recommendedActions: [],
    createdAt: now,
    updatedAt: now
  };
}

export function scoreOperationalAnswer(question: OperationalQuestion, answer?: OperationalAnswer) {
  if (!answer || answer.value === null || answer.value === "") return null;
  if (question.scoring.method === "boolean_positive") return answer.value === true || answer.value === "true" ? 5 : 0;
  if (question.scoring.method === "boolean_negative") return answer.value === true || answer.value === "true" ? 0 : 5;
  if (question.scoring.method === "percentage_to_score") return clampScore((Number(answer.value) / 100) * 5);
  if (question.scoring.method === "frequency_to_score") return question.options?.find((option) => option.value === answer.value)?.score ?? null;
  if (question.scoring.method === "direct_0_5") return clampScore(Number(answer.value));
  if (question.scoring.method === "weighted_options") return question.options?.find((option) => option.value === answer.value)?.score ?? null;
  return clampScore(Number(answer.value));
}

export function processOperationalAssessment(assessment: OperationalAssessment): OperationalAssessment {
  const scoredAnswers = assessment.answers.map((answer) => {
    const question = operationalQuestionBank.find((item) => item.id === answer.questionId);
    return question ? { ...answer, score: scoreOperationalAnswer(question, answer) } : answer;
  });
  const domains = Object.keys(operationalDomainLabels).map((domain) => calculateOperationalDomainScore(domain as OperationalDomain, scoredAnswers));
  const overallMaturityScore = calculateOverallOperationalMaturity(domains);
  const operationalRiskScore = calculateOperationalRiskScore(domains, scoredAnswers);
  const confidenceScore = calculateOperationalConfidenceScore(scoredAnswers);
  const findings = generateOperationalFindings(assessment.assessmentId, domains, scoredAnswers);
  const executiveSummary = generateOperationalExecutiveSummary({
    ...assessment,
    answers: scoredAnswers,
    domains,
    findings,
    overallMaturityScore,
    operationalRiskScore,
    confidenceScore
  });
  const now = new Date().toISOString();

  return {
    ...assessment,
    status: "completed",
    answers: scoredAnswers,
    domains,
    findings,
    overallMaturityScore,
    operationalRiskScore,
    confidenceScore,
    executiveSummaryText: executiveSummary.summaryText,
    keyStrengths: executiveSummary.keyStrengths,
    keyGaps: executiveSummary.keyGaps,
    topOperationalRisks: executiveSummary.topRisks,
    recommendedActions: executiveSummary.recommendedActions,
    executiveSummary,
    updatedAt: now
  };
}

export function calculateOperationalDomainScore(domain: OperationalDomain, answers: OperationalAnswer[]): OperationalDomainScore {
  const questions = operationalQuestionBank.filter((question) => question.domain === domain);
  let weightedScore = 0;
  let totalWeight = 0;
  let evidencePoints = 0;
  const strengths: string[] = [];
  const gaps: string[] = [];
  const relatedAnswers: string[] = [];
  const missingRequiredQuestions: string[] = [];
  const insufficientEvidenceQuestions: string[] = [];

  for (const question of questions) {
    const answer = answers.find((item) => item.questionId === question.id);
    const baseScore = answer?.score ?? scoreOperationalAnswer(question, answer);
    if (answer?.id) relatedAnswers.push(answer.id);
    if (baseScore === null) {
      if (question.required) {
        missingRequiredQuestions.push(question.id);
        gaps.push(`${question.id}: sin respuesta`);
        if (question.scoring.unknownBehavior !== "exclude_from_score") {
          weightedScore += 0;
          totalWeight += question.scoring.weight;
        }
      }
      continue;
    }
    const insufficientEvidence = hasInsufficientEvidence(question, answer);
    const score = insufficientEvidence ? Math.min(baseScore, operationalScoringConfig.evidenceScoreCapWhenInsufficient) : baseScore;
    weightedScore += score * question.scoring.weight;
    totalWeight += question.scoring.weight;
    evidencePoints += evidenceLevelScore(answer?.evidenceLevel ?? "none");
    if (insufficientEvidence) {
      insufficientEvidenceQuestions.push(question.id);
      gaps.push(`${question.id}: evidencia insuficiente`);
    }
    if (score >= 4) strengths.push(`${question.id}: ${question.question}`);
    if (score <= 2 || (question.critical && score < 3)) gaps.push(`${question.id}: ${question.question}`);
  }

  const score = totalWeight > 0 ? round1(weightedScore / totalWeight) : 0;
  const confidence = questions.length > 0 ? Math.round((evidencePoints / (questions.length * 5)) * 100) : 0;

  return {
    domain,
    score,
    maturityLevel: operationalMaturityLevel(score),
    riskContribution: Math.round(100 - (score / 5) * 100),
    confidence,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 4),
    recommendedActions: gaps.slice(0, 3).map((gap) => `Remediar ${gap}`),
    relatedQuestions: questions.map((question) => question.id),
    relatedAnswers,
    missingRequiredQuestions,
    insufficientEvidenceQuestions
  };
}

export function calculateOverallOperationalMaturity(domainScores: OperationalDomainScore[]) {
  if (domainScores.length === 0) return 0;
  return round1(domainScores.reduce((sum, domain) => sum + domain.score, 0) / domainScores.length);
}

export function calculateOperationalRiskScore(domainScores: OperationalDomainScore[], answers: OperationalAnswer[]) {
  const maturity = calculateOverallOperationalMaturity(domainScores);
  let risk = 100 - (maturity / 5) * 100;
  const answerScore = (id: string) => answers.find((answer) => answer.questionId === id)?.score ?? null;

  for (const domain of domainScores) {
    if (domain.score < 2) risk += operationalScoringConfig.riskAdjustments.lowDomainScore;
    if (domain.insufficientEvidenceQuestions.length > 0) risk += operationalScoringConfig.riskAdjustments.insufficientEvidenceCritical;
  }
  if ((answerScore("BCK-01") ?? 0) <= 1 || (answerScore("BCK-04") ?? 0) <= 1) risk += operationalScoringConfig.riskAdjustments.backupWeakness;
  if ((answerScore("MON-01") ?? 0) <= 1 || (answerScore("MON-04") ?? 0) <= 1) risk += operationalScoringConfig.riskAdjustments.monitoringWeakness;
  if ((answerScore("INC-01") ?? 0) <= 1) risk += operationalScoringConfig.riskAdjustments.incidentProcessMissing;
  if ((answerScore("CHG-01") ?? 0) <= 1) risk += operationalScoringConfig.riskAdjustments.changeProcessMissing;
  if ((answerScore("LFC-01") ?? 0) <= 1) risk += operationalScoringConfig.riskAdjustments.lifecycleControlMissing;

  return Math.round(Math.min(100, Math.max(0, risk)));
}

export function calculateOperationalConfidenceScore(answers: OperationalAnswer[]) {
  const answered = answers.filter((answer) => answer.value !== null && answer.value !== "");
  const answeredRatio = answered.length / operationalQuestionBank.length;
  const evidenceRatio = answered.length > 0 ? answered.reduce((sum, answer) => sum + evidenceLevelScore(answer.evidenceLevel), 0) / (answered.length * 5) : 0;
  const criticalQuestions = operationalQuestionBank.filter((question) => question.critical);
  const criticalAnswered = criticalQuestions.filter((question) => {
    const answer = answered.find((item) => item.questionId === question.id);
    return answer && !hasInsufficientEvidence(question, answer);
  }).length / criticalQuestions.length;
  return Math.round(
    answeredRatio * operationalScoringConfig.confidenceWeights.answeredRatio +
    evidenceRatio * operationalScoringConfig.confidenceWeights.evidenceRatio +
    criticalAnswered * operationalScoringConfig.confidenceWeights.criticalAnsweredRatio
  );
}

export function generateOperationalFindings(assessmentId: string, domainScores: OperationalDomainScore[], answers: OperationalAnswer[]): OperationalFinding[] {
  const findings: OperationalFinding[] = [];

  for (const domain of domainScores) {
    if (domain.score < 2) {
      findings.push(makeOperationalFinding({
        assessmentId,
        domain: domain.domain,
        title: `Madurez baja en ${operationalDomainLabels[domain.domain]}`,
        evidence: domain.gaps,
        severity: domain.score < 1 ? "critical" : "high",
        relatedQuestions: domain.relatedQuestions,
        relatedAnswers: domain.relatedAnswers
      }));
    }
    if (domain.missingRequiredQuestions.length > 0 || domain.insufficientEvidenceQuestions.length > 0) {
      findings.push(makeOperationalFinding({
        assessmentId,
        domain: domain.domain,
        title: `Evidencia operativa insuficiente en ${operationalDomainLabels[domain.domain]}`,
        evidence: [
          ...domain.missingRequiredQuestions.map((id) => `${id}: sin respuesta requerida`),
          ...domain.insufficientEvidenceQuestions.map((id) => `${id}: evidencia por debajo del minimo`)
        ],
        severity: domain.missingRequiredQuestions.length > 2 ? "high" : "medium",
        relatedQuestions: [...domain.missingRequiredQuestions, ...domain.insufficientEvidenceQuestions],
        relatedAnswers: domain.relatedAnswers
      }));
    }
  }

  const answerById = (id: string) => answers.find((answer) => answer.questionId === id);
  const answerScore = (id: string) => answerById(id)?.score ?? null;
  if ((answerScore("BCK-01") ?? 5) <= 1 && (answerScore("BCK-04") ?? 5) <= 1) {
    findings.push(makeOperationalFinding({
      assessmentId,
      domain: "backup_config",
      title: "Debilidad en respaldo y recuperacion de configuraciones de red",
      evidence: [answerEvidenceLine("BCK-01", answerById("BCK-01")), answerEvidenceLine("BCK-04", answerById("BCK-04"))],
      severity: "high",
      relatedQuestions: ["BCK-01", "BCK-04"],
      relatedAnswers: [answerById("BCK-01")?.id, answerById("BCK-04")?.id].filter((id): id is string => Boolean(id))
    }));
  }
  if ((answerScore("MON-01") ?? 5) <= 1 && (answerScore("MON-04") ?? 5) <= 1) {
    findings.push(makeOperationalFinding({
      assessmentId,
      domain: "monitoring",
      title: "Cobertura insuficiente de monitoreo y alertamiento critico",
      evidence: [answerEvidenceLine("MON-01", answerById("MON-01")), answerEvidenceLine("MON-04", answerById("MON-04"))],
      severity: "high",
      relatedQuestions: ["MON-01", "MON-04"],
      relatedAnswers: [answerById("MON-01")?.id, answerById("MON-04")?.id].filter((id): id is string => Boolean(id))
    }));
  }

  return findings;
}

export function buildOperationalAIContext(assessment: OperationalAssessment) {
  return {
    assessmentId: assessment.assessmentId,
    domainScores: assessment.domains,
    keyGaps: assessment.keyGaps,
    keyStrengths: assessment.keyStrengths,
    preliminaryFindings: assessment.findings,
    lowConfidenceAreas: assessment.domains.filter((domain) => domain.confidence < 50).map((domain) => domain.domain)
  };
}

export function generateOperationalExecutiveSummary(assessment: OperationalAssessment): OperationalExecutiveSummary {
  const maturityLevel = operationalMaturityLevel(assessment.overallMaturityScore);
  const keyStrengths = assessment.domains.flatMap((domain) => domain.strengths).slice(0, 3);
  const keyGaps = assessment.domains.flatMap((domain) => domain.gaps).slice(0, 5);
  const topRisks = assessment.findings.slice(0, 5).map((finding) => finding.title);
  const recommendedActions = assessment.domains.flatMap((domain) => domain.recommendedActions).slice(0, 5);

  return {
    assessmentId: assessment.assessmentId,
    overallMaturityScore: assessment.overallMaturityScore,
    operationalRiskScore: assessment.operationalRiskScore,
    confidenceScore: assessment.confidenceScore,
    maturityLevel,
    summaryText: `La madurez operativa se clasifica como ${maturityLevel}, con riesgo operativo ${assessment.operationalRiskScore}/100 y confianza ${assessment.confidenceScore}/100.`,
    keyStrengths,
    keyGaps,
    topRisks,
    recommendedActions,
    impactOnRiskIndex: assessment.operationalRiskScore >= 60 ? "Incrementa la dimension Operacion y soporte del IRIR." : "Impacto operativo controlado sobre IRIR.",
    impactOnConfidenceIndex: assessment.confidenceScore < 70 ? "Reduce confianza del assessment ejecutivo." : "Aporta confianza operacional suficiente.",
    validationStatus: assessment.status,
    lastUpdated: new Date().toISOString()
  };
}

export function operationalMaturityLevel(score: number) {
  if (score <= 1) return "Inexistente / Reactivo";
  if (score <= 2) return "Basico";
  if (score <= 3) return "Definido parcialmente";
  if (score <= 4) return "Gestionado";
  return "Optimizado";
}

function makeOperationalFinding(input: {
  assessmentId: string;
  domain: OperationalDomain;
  title: string;
  evidence: string[];
  severity: OperationalFinding["severity"];
  relatedQuestions: string[];
  relatedAnswers: string[];
}): OperationalFinding {
  return {
    id: uid("opfind"),
    assessmentId: input.assessmentId,
    domain: input.domain,
    title: input.title,
    description: input.title,
    severity: input.severity,
    confidence: input.evidence.length > 0 ? 0.75 : 0.45,
    evidence: input.evidence,
    affectedCapabilities: [operationalDomainLabels[input.domain]],
    businessImpact: "Mayor exposicion a interrupciones operativas y tiempos de recuperacion extendidos.",
    technicalImpact: "Debilidad en procesos de operacion, control y trazabilidad.",
    recommendation: "Formalizar proceso, responsables, evidencia y medicion recurrente.",
    remediationCategory: "operational_change",
    relatedQuestions: input.relatedQuestions,
    relatedAnswers: input.relatedAnswers,
    status: "draft"
  };
}

function answerEvidenceLine(questionId: string, answer?: OperationalAnswer) {
  if (!answer) return `${questionId}: sin respuesta`;
  return `${questionId}: respuesta=${String(answer.value)}; score=${answer.score ?? "pendiente"}; evidencia=${answer.evidenceLevel}`;
}

function domainRiskDimensions(domain: OperationalDomain) {
  const map: Record<OperationalDomain, string[]> = {
    governance: ["operations"],
    inventory_documentation: ["documentation"],
    monitoring: ["operations", "performance"],
    incidents: ["operations", "resiliency"],
    change_management: ["configuration", "operations"],
    backup_config: ["resiliency", "operations"],
    lifecycle_support: ["lifecycle"],
    capacity_performance: ["performance"],
    continuity_dr: ["resiliency"],
    automation_improvement: ["operations"]
  };
  return map[domain];
}

function evidenceLevelScore(level: OperationalEvidenceLevel) {
  return operationalScoringConfig.evidenceLevelScore[level];
}

function hasInsufficientEvidence(question: OperationalQuestion, answer?: OperationalAnswer) {
  if (!answer || answer.value === null || answer.value === "") return false;
  if (!question.evidenceRequired) return false;
  return evidenceLevelScore(answer.evidenceLevel) < evidenceLevelScore(question.scoring.minimumEvidenceLevel);
}

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : null;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
