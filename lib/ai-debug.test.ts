import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCapturedJson } from "./ai-debug.ts";

test("sanitizeCapturedJson strips authorization and API key material", () => {
  const sanitized = sanitizeCapturedJson({
    headers: {
      Authorization: "Bearer sk-test-secret",
      "x-openai-api-key": "sk-test-secret"
    },
    body: {
      apiKey: "sk-test-secret",
      nested: {
        token: "sk-test-secret"
      },
      prompt: "safe prompt"
    }
  });

  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes("sk-test-secret"), false);
  assert.equal(serialized.includes("Authorization"), true);
  assert.equal(serialized.includes("safe prompt"), true);
});
