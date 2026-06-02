import assert from "node:assert/strict";
import {
  calculateOperationalConfidenceScore,
  calculateOperationalDomainScore,
  calculateOperationalRiskScore,
  calculateOverallOperationalMaturity,
  createDefaultOperationalAssessment,
  generateOperationalExecutiveSummary,
  generateOperationalFindings,
  operationalQuestionBank,
  processOperationalAssessment,
  scoreOperationalAnswer,
  type OperationalAnswer
} from "./operational-assessment.ts";

const assessment = createDefaultOperationalAssessment("assess_test", "client_test");
const booleanQuestion = operationalQuestionBank.find((question) => question.id === "GOV-01")!;
const yesAnswer: OperationalAnswer = {
  id: "a1",
  questionId: "GOV-01",
  interviewId: "i1",
  assessmentId: "assess_test",
  value: true,
  score: null,
  evidenceLevel: "documented",
  evidenceFiles: [],
  comments: "",
  answeredBy: "tester",
  reviewedByArchitect: false
};

assert.equal(scoreOperationalAnswer(booleanQuestion, yesAnswer), 5);

const processed = processOperationalAssessment({
  ...assessment,
  answers: [
    yesAnswer,
    { ...yesAnswer, id: "a2", questionId: "BCK-01", value: false, evidenceLevel: "self_declared" },
    { ...yesAnswer, id: "a3", questionId: "BCK-04", value: false, evidenceLevel: "self_declared" }
  ]
});

const backupDomain = calculateOperationalDomainScore("backup_config", processed.answers);
assert.equal(backupDomain.score, 0);
assert.ok(backupDomain.missingRequiredQuestions.length > 0);

const monitoringDomain = calculateOperationalDomainScore("monitoring", [
  { ...yesAnswer, id: "m1", questionId: "MON-01", value: 100, evidenceLevel: "self_declared" }
]);
assert.ok(monitoringDomain.score <= 2, "critical answers without documented evidence must be capped");

assert.ok(calculateOverallOperationalMaturity(processed.domains) >= 0);
assert.ok(calculateOperationalRiskScore(processed.domains, processed.answers) > 0);
assert.ok(calculateOperationalConfidenceScore(processed.answers) > 0);
const findings = generateOperationalFindings("assess_test", processed.domains, processed.answers);
assert.ok(findings.length > 0);
assert.ok(findings.every((finding) => finding.relatedQuestions.length > 0));
assert.ok(generateOperationalExecutiveSummary(processed).summaryText.length > 0);
