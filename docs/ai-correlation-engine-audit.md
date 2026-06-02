# AI Correlation Engine audit

## Findings

- The current engine already separated normalized context, correlation candidates and AI suggested findings, but evidence traceability was still too string-oriented.
- AI output validation checked basic safety rules, but did not reject invented `evidenceRefs`, metric IDs, fact IDs or correlation IDs against the assessment context.
- Snapshot performance metrics were identified in context, but AI validation did not explicitly block trend or recurrence claims based only on snapshot data.
- A legacy raw-context helper still existed in the UI file. It was not active, but it created a future regression path where raw snippets could be sent to AI.
- Roadmap generation used all non-discarded findings, which could include AI suggestions not accepted by the architect.

## Corrections

- Added `EvidenceReference` catalog to `AssessmentAIContext`, preserving source file, inferred command, device, interface, metric, fact, relation and excerpt when available.
- Added contextual validation for AI suggestions against the evidence, metric, config fact, state fact and correlation candidate catalogs.
- Blocked confirmed findings based only on performance snapshots and blocked historical trend claims when only snapshot metrics exist.
- Removed legacy raw AI context generation and generic fallback AI finding templates from the UI module.
- Kept performance AI review findings as `ai_suggested` instead of downgrading them to generic `ai-draft`.
- Changed roadmap input to accepted, edited or validated findings only.
- Added UI traceability metadata for AI findings so reviewers can see evidence source details.

## Guardrails

- Deterministic facts remain produced by parsers and deterministic engines.
- Correlation candidates remain deterministic and evidence-bound.
- AI suggested findings remain suggestions until accepted, edited or validated.
- Executive, risk and roadmap outputs do not consume discarded AI findings or unaccepted AI suggestions.
