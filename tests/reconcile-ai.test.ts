import test from "node:test";
import assert from "node:assert/strict";
import { LocalByok, createAiPreview } from "../src/lib/reconcile-ai";
import { scanWorkbooks } from "../src/lib/reconcile";
import { demoWorkbooks } from "../src/lib/reconcile-demo";

const report = () => scanWorkbooks(demoWorkbooks());
const success = () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "Review duplicate contacts and ambiguous dates before making a correction copy." }] }], usage: { input_tokens: 100, output_tokens: 20 } });
test("AI stays off without explicit user key and per-request exact payload consent; ambient key is ignored", async () => {
  const ambient = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "sk-owner-never-used";
  let calls = 0;
  try {
    const ai = new LocalByok(undefined, async () => { calls++; return success(); });
    const scan = report(), preview = createAiPreview(scan, ai.model);
    await assert.rejects(ai.explain(scan, { enabled: false, approvedPayloadHash: preview.payloadHash }), /explicit/);
    await assert.rejects(ai.explain(scan, { enabled: true, approvedPayloadHash: preview.payloadHash }), /No user key/);
    ai.setKey("sk-test-user-key-123456789");
    await assert.rejects(ai.explain(scan, { enabled: true, approvedPayloadHash: "stale" }), /current outgoing/);
    assert.equal(calls, 0);
    ai.removeKey(); assert.equal(ai.status().keyPresent, false);
  } finally { if (ambient === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ambient; }
});
test("AI sends exactly previewed aggregate payload, no contacts, private content, tools or owner credential", async () => {
  let calls = 0;
  const ai = new LocalByok("gpt-5.4-mini", async (url, init) => {
    calls++; assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer sk-test-user-key-123456789");
    assert.deepEqual(JSON.parse(String(init?.body)), preview.payload);
    assert.doesNotMatch(String(init?.body), /rosa|example.test|PRIVATE_FIXTURE|demo-community|Fictional community/i);
    assert.equal(preview.payload.max_output_tokens, 800); assert.equal(preview.payload.store, false);
    return success();
  });
  ai.setKey("sk-test-user-key-123456789");
  const scan = report(), preview = createAiPreview(scan, ai.model);
  const consent = { enabled: true, approvedPayloadHash: preview.payloadHash };
  const run = await ai.explain(scan, consent);
  assert.equal(run.status, "completed"); assert.deepEqual(run.usage, { known: true, inputTokens: 100, outputTokens: 20 });
  assert.deepEqual(await ai.explain(scan, consent), run); assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(ai), /sk-test/);
});
test("AI failure is sanitized, unknown cost is honest, and same payload never retries", async () => {
  let calls = 0;
  const ai = new LocalByok(undefined, async () => { calls++; throw new Error("sk-sensitive echo"); });
  ai.setKey("sk-test-user-key-123456789");
  const scan = report(), consent = { enabled: true, approvedPayloadHash: createAiPreview(scan, ai.model).payloadHash };
  const run = await ai.explain(scan, consent);
  assert.equal(run.status, "failed"); assert.equal(run.usage.known, false); assert.doesNotMatch(JSON.stringify(run), /sk-sensitive/);
  await ai.explain(scan, consent); assert.equal(calls, 1);
});
test("AI concurrency is one and attempts are bounded including failures", async () => {
  let finish!: (response: Response) => void;
  const ai = new LocalByok(undefined, () => new Promise(resolve => { finish = resolve; }));
  ai.setKey("sk-test-user-key-123456789");
  const scan = report(), consent = { enabled: true, approvedPayloadHash: createAiPreview(scan, ai.model).payloadHash };
  const pending = ai.explain(scan, consent);
  await assert.rejects(ai.explain({ ...scan, id: "different" }, consent), /already running/);
  finish(success()); await pending;
  const bounded = new LocalByok(undefined, async () => new Response("error", { status: 500 }));
  bounded.setKey("sk-test-user-key-123456789");
  for (let i = 0; i < 12; i++) await bounded.explain({ ...scan, id: String(i) }, consent);
  await assert.rejects(bounded.explain({ ...scan, id: "limit" }, consent), /twelve/);
});
