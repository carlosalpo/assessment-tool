# AI Analysis Audit

## Current Implementation Findings

- Current prompts are built in `app/api/ai/evaluate/route.ts` as one generic system prompt plus an area label.
- Current context is built in `app/page.tsx` through `buildAiEvaluationContext`. It mixes normalized parsed data with raw evidence snippets.
- AI output is mapped directly into the classic `Finding` model with `status: ai-draft`.
- The old output schema requires evidence and confidence, but it does not model finding type, correlation source, related metrics, config facts, state facts, or validation questions.
- AI is not currently preceded by a deterministic correlation layer. It can see parsed data and snippets, but it is responsible for contextual correlation.
- Risk and executive views currently rely primarily on validated findings. AI findings are visible in Hallazgos but not explicitly separated as accepted/suggested/validated.
- Performance analysis already has deterministic metric parsing and findings, but it is not correlated with topology, configuration, lifecycle, and operational visibility before AI.
- Document generation can include findings, but it does not have a dedicated contextual-correlation section unless the template includes placeholders for it.

## Main Risks

- Generic prompting increases hallucination risk.
- Raw snippets can hide or overemphasize facts without explicit normalized evidence references.
- Lack of correlation candidates makes AI act as both detector and reviewer.
- Lack of strict AI finding type means absence of evidence can be confused with confirmed risk.
- No unit tests existed for cross-domain AI context or correlation rules.
