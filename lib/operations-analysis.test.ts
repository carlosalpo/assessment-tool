import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultOperationalAssessment,
  operationalQuestionBank,
  processOperationalAssessment,
  type OperationalAnswer
} from "./operational-assessment.ts";
import {
  applyOperationsNarration,
  buildOperationsFindings,
  isOperationalAssessmentComplete
} from "./operations-analysis.ts";
import { isVacuousRemediation } from "./remediation-quality.ts";

function completedAssessment() {
  const base = createDefaultOperationalAssessment("assess_ops", "client_ops");
  const interview = {
    id: "opint_1",
    assessmentId: base.assessmentId,
    interviewType: "network_operations" as const,
    participants: "NOC",
    date: "2026-06-05",
    durationMinutes: 60,
    interviewer: "Arquitecto",
    notes: "Entrevista operativa completa."
  };
  const answers: OperationalAnswer[] = operationalQuestionBank.map((question) => ({
    id: `ans_${question.id}`,
    questionId: question.id,
    interviewId: interview.id,
    assessmentId: base.assessmentId,
    value: valueForQuestion(question.id, question.responseType),
    score: null,
    evidenceLevel: question.critical ? "documented" : "self_declared",
    evidenceFiles: question.critical ? [`${question.id}.pdf`] : [],
    comments: "",
    answeredBy: "NOC",
    reviewedByArchitect: true
  }));
  return processOperationalAssessment({
    ...base,
    status: "in_progress",
    interviews: [interview],
    answers
  });
}

test("buildOperationsFindings creates deterministic findings from complete interview data", () => {
  const assessment = completedAssessment();
  const findings = buildOperationsFindings(assessment);

  assert.equal(isOperationalAssessmentComplete(assessment), true);
  assert.ok(findings.length > 0);
  assert.ok(findings.some((finding) => finding.area === "monitoring"));
  const monitoring = findings.find((finding) => finding.area === "monitoring");
  assert.equal(monitoring?.remediationCategory, "operational_change");
  assert.ok(["high", "critical"].includes(monitoring?.severity ?? ""));
  assert.ok(findings.every((finding) => !isVacuousRemediation(finding.recommendation)));
  assert.deepEqual(findings, buildOperationsFindings(assessment));
});

test("buildOperationsFindings returns no findings when interviews are incomplete", () => {
  const assessment = completedAssessment();
  const incomplete = {
    ...assessment,
    status: "in_progress" as const,
    answers: assessment.answers.filter((answer) => answer.questionId !== operationalQuestionBank[0].id)
  };

  assert.equal(isOperationalAssessmentComplete(incomplete), false);
  assert.deepEqual(buildOperationsFindings(incomplete), []);
  assert.deepEqual(buildOperationsFindings(undefined), []);
});

test("applyOperationsNarration only updates narrative fields", () => {
  const [finding] = buildOperationsFindings(completedAssessment());
  const [narrated] = applyOperationsNarration([finding], [{
    finding_id: finding.id,
    severity: "low",
    status: "ignored",
    remediationCategory: "new_technology",
    technical_rationale: "Texto tecnico editado.",
    business_impact: "Impacto editado.",
    recommendation: "Recomendacion editada."
  }]);

  assert.equal(narrated.severity, finding.severity);
  assert.equal(narrated.status, finding.status);
  assert.equal(narrated.remediationCategory, finding.remediationCategory);
  assert.equal(narrated.technical_rationale, "Texto tecnico editado.");
  assert.equal(narrated.business_impact, "Impacto editado.");
  assert.equal(narrated.recommendation, "Recomendacion editada.");
});

function valueForQuestion(questionId: string, responseType: string) {
  if (questionId === "MON-01") return 10;
  if (questionId.startsWith("MON-")) {
    if (responseType === "frequency") return "never";
    return false;
  }
  if (responseType === "percentage") return 95;
  if (responseType === "frequency") return "monthly";
  if (responseType === "maturity_0_5") return 4;
  if (responseType === "multi_select") return ["documented"];
  if (responseType === "number") return 1;
  if (responseType === "duration") return 60;
  if (responseType === "text") return "Documentado";
  return true;
}
