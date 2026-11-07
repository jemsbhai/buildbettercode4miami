import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { canonicalDonorId, decideMerge, detectMergeCandidates, getMetrics, getQueue, importGiftCsv } from "../src/lib/domain";
import { currentGivingCycle } from "../src/lib/records-schedule";

const header = "gift_id,donor_id,name,email,phone,amount_cents,date,channel";

test("fulfilled monthly installments reopen on their next due date without stale failure attribution", () => {
  const state = createSeed();
  importGiftCsv(state, `${header}\nseptember-paid,donor-jules,Jules Pierre,jules@example.test,,5000,2026-09-29,online`, "paid.csv");
  for (const asOf of ["2026-09-30", "2026-10-27"]) {
    state.asOf = asOf;
    assert.ok(!getQueue(state).some((item) => item.kind === "monthly"));
  }
  state.asOf = "2026-10-28";
  const reopened = getQueue(state).find((item) => item.kind === "monthly")!;
  assert.match(reopened.reason, /due 2026-10-28/);
  assert.match(reopened.reason, /Cause unknown/);
  assert.doesNotMatch(reopened.reason, /expired card/);
  assert.ok(!reopened.sourceIds.includes("src-failure-jules"));
  assert.equal(reopened.priority, "medium");
  importGiftCsv(state, `${header}\noctober-paid,donor-jules,Jules Pierre,jules@example.test,,5000,2026-10-28,online`, "paid.csv");
  assert.ok(!getQueue(state).some((item) => item.kind === "monthly"));
  state.asOf = "2026-11-28";
  assert.match(getQueue(state).find((item) => item.kind === "monthly")!.reason, /due 2026-11-28/);
});

test("recurrence clamps month ends and leap days without drifting or inventing past cycles", () => {
  const donor = { id: "calendar", name: "Calendar", emails: [], phone: "", sourceIds: [], cadence: "monthly" as const, expectedAt: "2028-01-31" };
  assert.equal(currentGivingCycle(donor, "2028-01-30"), undefined);
  assert.equal(currentGivingCycle(donor, "2028-02-28")!.due, "2028-01-31");
  assert.equal(currentGivingCycle(donor, "2028-02-29")!.due, "2028-02-29");
  assert.equal(currentGivingCycle(donor, "2028-03-30")!.due, "2028-02-29");
  assert.equal(currentGivingCycle(donor, "2028-03-31")!.due, "2028-03-31");
  const annual = { ...donor, cadence: "annual" as const, expectedAt: "2028-02-29" };
  assert.equal(currentGivingCycle(annual, "2029-02-28")!.due, "2029-02-28");
  assert.equal(currentGivingCycle(annual, "2032-02-28")!.due, "2031-02-28");
  assert.equal(currentGivingCycle(annual, "2032-02-29")!.due, "2032-02-29");
});

test("annual December grace respects its payment window and recurs after fulfillment", () => {
  const state = createSeed();
  state.asOf = "2025-12-31";
  assert.ok(!getQueue(state).some((item) => item.kind === "annual"));
  state.asOf = "2026-01-01";
  assert.match(getQueue(state).find((item) => item.kind === "annual")!.reason, /December 2025/);
  importGiftCsv(state, `${header}\nannual-paid,donor-ana,Ana Torres,ana@example.test,,50000,2025-12-31,check`, "history.csv");
  assert.ok(!getQueue(state).some((item) => item.kind === "annual"));
  state.asOf = "2026-12-31";
  assert.ok(!getQueue(state).some((item) => item.kind === "annual"));
  state.asOf = "2027-01-01";
  assert.match(getQueue(state).find((item) => item.kind === "annual")!.reason, /December 2026/);
  importGiftCsv(state, `${header}\nannual-next,donor-ana,Ana Torres,ana@example.test,,50000,2026-12-15,check`, "history.csv");
  assert.ok(!getQueue(state).some((item) => item.kind === "annual"));
});

test("literal annual anchors describe the configured date, never an invented December schedule", () => {
  const state = createSeed();
  state.donors.find((donor) => donor.id === "donor-ana")!.expectedAt = "2026-06-15";
  const item = getQueue(state).find((entry) => entry.kind === "annual")!;
  assert.match(item.reason, /Annual gift due 2026-06-15/);
  assert.doesNotMatch(item.reason, /December/);
});

test("only failures from the current cycle explain a missing payment", () => {
  const state = createSeed();
  state.asOf = "2026-10-29";
  state.sources.push({ id: "src-current-failure", source: "failures.csv", row: 2, values: { reason: "declined" }, importedAt: "2026-10-29T00:00:00Z" });
  state.paymentFailures.push({ id: "current-failure", donorId: "donor-jules", date: "2026-10-28", reason: "declined", sourceIds: ["src-current-failure"] });
  const item = getQueue(state).find((entry) => entry.kind === "monthly")!;
  assert.match(item.reason, /declined/);
  assert.doesNotMatch(item.reason, /expired card/);
  assert.ok(item.sourceIds.includes("src-current-failure"));
  assert.ok(!item.sourceIds.includes("src-failure-jules"));
  assert.equal(item.priority, "high");
});

test("a rejected group stays separate when new imports bridge its contacts", () => {
  const state = createSeed();
  const rejected = structuredClone(state.candidates[0]);
  decideMerge(state, rejected.id, "reject");
  importGiftCsv(state, `${header}\nbridge-gift,bridge-person,Rosa New,rosa@example.test,,500,2026-09-30,check`, "new.csv");
  assert.equal(state.candidates.find((item) => item.id === rejected.id)!.status, "rejected");
  const pending = state.candidates.filter((item) => item.status === "pending");
  assert.ok(pending.length);
  for (const item of pending) assert.ok(item.donorIds.filter((id) => rejected.donorIds.includes(id)).length < 2);
  decideMerge(state, pending[0].id, "approve");
  assert.equal(new Set(rejected.donorIds.map((id) => canonicalDonorId(state, id))).size, 3);
  state.candidates = detectMergeCandidates(state);
  for (const item of state.candidates.filter((entry) => entry.status === "pending")) {
    assert.ok(item.donorIds.filter((id) => rejected.donorIds.map((original) => canonicalDonorId(state, original)).includes(id)).length < 2);
  }
});

test("approval cannot bypass a historical keep-separate decision using a stale candidate", () => {
  const state = createSeed();
  const candidate = structuredClone(state.candidates[0]);
  decideMerge(state, candidate.id, "reject");
  state.candidates.push({ ...candidate, id: "stale-duplicate", status: "pending" });
  const before = structuredClone(state);
  assert.throws(() => decideMerge(state, "stale-duplicate", "approve"), /keep-separate/);
  assert.deepEqual(state, before);
});

test("exact gift replays survive merges but changed identity metadata fail atomically", () => {
  const state = createSeed();
  const row = "repeat,donor-rosa-online,Rosa Delgado,rosa@example.test,+1-305-555-0101,500,2026-09-30,check";
  importGiftCsv(state, `${header}\n${row}`, "new.csv");
  decideMerge(state, state.candidates.find((item) => item.status === "pending")!.id, "approve");
  const before = structuredClone(state);
  assert.deepEqual(importGiftCsv(state, `${header}\n${row}`, "renamed.csv"), { inserted: 0, skipped: 1 });
  assert.deepEqual(state, before);
  for (const changed of [row.replace("Rosa Delgado", "Someone Else"), row.replace("rosa@example.test", "unrelated@example.test"), row.replace("0101", "0199")]) {
    assert.throws(() => importGiftCsv(state, `${header}\nnewgood,newgood,Good Person,good@example.test,,100,2026-09-30,check\n${changed}`, "bad.csv"), /identity metadata/);
    assert.deepEqual(state, before);
  }
  assert.throws(() => importGiftCsv(state, `${header}\ngift-online-101,donor-rosa-online,Rosa Delgado,unrelated@example.test,,12500,2026-07-10,online`, "seed-replay.csv"), /identity metadata/);
});

test("new contact evidence on an already merged alias remains discoverable without rewriting gifts", () => {
  const state = createSeed();
  decideMerge(state, state.candidates[0].id, "approve");
  const historical = structuredClone(state.gifts);
  importGiftCsv(state, `${header}\nnew-alias-contact,donor-rosa-online,Rosa Delgado,new.rosa@example.test,+1-305-555-0101,500,2026-09-30,check\nnew-alias-person,new-person,Rosa New,new.rosa@example.test,,500,2026-09-30,online`, "alias.csv");
  assert.deepEqual(state.gifts.slice(0, historical.length), historical);
  const pending = state.candidates.find((item) => item.status === "pending")!;
  assert.ok(pending.donorIds.includes("new-person"));
  assert.ok(pending.donorIds.includes(canonicalDonorId(state, "donor-rosa-online")));
  assert.ok(pending.sourceIds.includes("src-import-new-alias-contact"));
  decideMerge(state, pending.id, "approve");
  assert.equal(getMetrics(state).find((metric) => metric.id === "donors")!.value, 3);
  assert.equal(getMetrics(state).find((metric) => metric.id === "giving")!.value, 645);
});
