import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = process.env.TIDEPATH_URL || "http://127.0.0.1:3210";
const origin = new URL(base);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) throw new Error("Smoke tests reset state and may only target a local demo.");
let checks = 0;
async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(`${base}/api/${path}`, { method, headers: { Origin: origin.origin, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 500)}`);
  checks++;
  return response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text;
}

await request("reset", "POST");
const crossOrigin = await fetch(`${base}/api/reset`, { method: "POST", headers: { Origin: "https://unrelated.example" } });
assert.equal(crossOrigin.status, 403);
checks++;
const initial = await request("dashboard");
assert.equal(JSON.stringify(initial).includes("PRIVATE_SENTINEL"), false);
const giving = initial.metrics.find(metric => metric.id === "giving").value;
const donorCount = initial.metrics.find(metric => metric.id === "donors").value;
const merged = await request("merge", "POST", { candidateId: initial.state.candidates[0].id, decision: "approve" });
assert.equal(merged.metrics.find(metric => metric.id === "giving").value, giving);
assert.equal(merged.metrics.find(metric => metric.id === "donors").value, donorCount - 2);
assert.equal(merged.state.gifts.length, initial.state.gifts.length);

let { draft } = await request("drafts", "POST", { kind: "report", mode: "demo" });
const wrong = structuredClone(draft.claims); wrong[0].value += 1;
({ draft } = await request(`drafts/${draft.id}`, "PATCH", { revision: draft.revision, claims: wrong }));
const blocked = await request(`drafts/${draft.id}/approve`, "POST", { revision: draft.revision }, 422);
assert(blocked.issues.some(issue => issue.code === "claim_mismatch"));
({ draft } = await request(`drafts/${draft.id}`, "PATCH", { revision: draft.revision, claims: merged.metrics.map(metric => ({ metricId: metric.id, value: metric.value })) }));
await request(`drafts/${draft.id}/approve`, "POST", { revision: draft.revision });
assert.match(await request(`drafts/${draft.id}/export`), /Quarter giving/);

const followup = await request("drafts", "POST", { kind: "followup", queueItemId: merged.queue[0].id, mode: "demo" });
await request(`drafts/${followup.draft.id}/approve`, "POST", { revision: 1 });
const receipt = await request(`drafts/${followup.draft.id}/send`, "POST", { revision: 1 });
assert.equal(receipt.message.transport, "simulation");
const repeat = await request(`drafts/${followup.draft.id}/send`, "POST", { revision: 1 });
assert.equal(repeat.message.id, receipt.message.id);

const grant = merged.state.grants[0];
let application = await request("drafts", "POST", { kind: "application", grantId: grant.id, mode: "demo" });
await request(`drafts/${application.draft.id}/approve`, "POST", { revision: 1 });
const answer = await request(`drafts/${application.draft.id}/export`);
assert(answer.trim().split(/\s+/).length <= grant.wordLimit);
application = await request(`drafts/${application.draft.id}`, "PATCH", { revision: 1, narrative: "community ".repeat(grant.wordLimit) });
const lengthBlocked = await request(`drafts/${application.draft.id}/approve`, "POST", { revision: application.draft.revision }, 422);
assert(lengthBlocked.issues.some(issue => issue.code === "application_word_limit"));
assert(merged.ledgers[0].categories.some(category => category.status === "over_budget"));
assert(merged.ledgers[0].disallowed.length > 0);

const note = (await request(`notes/${initial.state.notes[0].id}`)).note;
assert.match(note.privateDetail, /PRIVATE_SENTINEL/);
const preview = await request("disclosures", "POST", { noteId: note.id, grantId: note.grantId });
assert.equal(JSON.stringify(preview).includes("PRIVATE_SENTINEL"), false);
await request(`disclosures/${preview.disclosure.id}/approve`, "POST", { payloadHash: preview.disclosure.payloadHash });
assert.deepEqual(await request(`disclosures/${preview.disclosure.id}/export`), preview.disclosure.payload);
const nonpayable = initial.state.notes.find(item => !item.payable);
await request("disclosures", "POST", { noteId: nonpayable.id, grantId: nonpayable.grantId }, 400);
await request(`notes/${note.id}`, "PATCH", { goal: note.goal, progress: "Family practiced a different activity.", privateDetail: note.privateDetail, durationMinutes: note.durationMinutes });
await request(`disclosures/${preview.disclosure.id}/export`, "GET", undefined, 400);
await request(`drafts/${draft.id}/export`, "GET", undefined, 422);

const csv = readFileSync("public/samples/gifts.csv", "utf8");
const imported = await request("import", "POST", { csv, sourceName: "gifts.csv" });
assert(imported.inserted > 0);
const again = await request("import", "POST", { csv, sourceName: "gifts.csv" });
assert.equal(again.inserted, 0);
assert.equal(again.skipped, imported.inserted);
const attendance = initial.state.attendance.find(item => item.status === "absent");
await request("attendance", "POST", { participantId: attendance.participantId, date: attendance.date, status: "present" });
const current = await request("dashboard");
assert.equal(current.state.attendance.length, initial.state.attendance.length);

if (process.argv.includes("--live")) {
  const live = await request("drafts", "POST", { kind: "report", mode: "live" });
  assert.equal(live.draft.mode, "live");
  const run = live.dashboard.state.runs.find(run => run.id === live.draft.runId);
  assert(run.inputTokens > 0);
  assert(run.events.some(event => event.action === "evidence_read"));
  await request(`drafts/${live.draft.id}/approve`, "POST", { revision: live.draft.revision });
  console.log(`Live agent verified: ${run.model}, ${run.inputTokens} input / ${run.outputTokens} output tokens.`);
}
await request("reset", "POST");
console.log(`Passed ${checks} HTTP checks: records, claims, follow-up simulation, grant limits, fiscal ledger, disclosure, imports, attendance, and reset.`);
