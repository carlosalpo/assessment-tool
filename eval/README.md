# Offline Golden Eval

This directory contains the offline golden harness for Evaluacion AI scope findings. It is deterministic, does not call Prisma job runners, and does not call OpenAI in CI.

Run it with:

```bash
npm run test:eval
```

## Directory layout

- `fixtures/*.ts`: synthetic `AssessmentAIContextInput` records. Fixtures should use explicit evidence lines and stable hostnames so packet evidence refs stay deterministic.
- `golden/*.json`: one file per fixture+scope. Each file has `mustFind[]` and `mustNotFind[]` signatures.
- `model-stubs/*.json`: raw canonical `scope_analysis_result` model outputs for the same fixture+scope filename. Stubs may include hallucinations on purpose; `validateScopeAnalysisResult` must reject them.
- `matching.ts`: signature matcher for `scopeId`, `finding_type`, severity floor, keyword overlap, and device overlap.
- `metrics.ts`: precision, recall, coverage, missing `mustFind`, and leaked `mustNotFind`.
- `thresholds.json`: approval thresholds by scope and aggregate.

## Adding a fixture

1. Add a fixture record to `eval/fixtures/index.ts`.
2. Add one or more `eval/golden/<fixture>.<scope>.json` files.
3. Add matching `eval/model-stubs/<fixture>.<scope>.json` files.
4. Run `npm run test:eval`.

Golden signatures intentionally stay semantic:

```json
{
  "scopeId": "security",
  "finding_type": "confirmed_finding",
  "severityAtLeast": "high",
  "keywords": ["snmp", "public"],
  "devices": ["edge-mgmt"]
}
```

The test fails when any `mustFind` is missing or any `mustNotFind` leaks after validation. The report prints precision, recall, coverage, produced count, rejected count, and leaked count per scope.

## Live mode TODO

Optional periodic live evaluation can be added behind `EVAL_LIVE=1`. In that mode, the harness should replace `model-stubs/*.json` with a real model call using the same `AIScopePacket`, for example through a future pure seam such as `analyzeScopeWithModel(packet, apiKey)`.

`EVAL_LIVE=1` must remain manual and must never run in CI by default.
