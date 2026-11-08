import assert from "node:assert/strict";
import test from "node:test";
import type { Dashboard, Draft } from "../src/lib/types";
import { overviewCards, inboxCards, grantsCards, counselingCards } from "../src/lib/workspace-summaries";

function emptyDashboard(): Dashboard {
  return {
    state: { schemaVersion: 1, revision: 1, asOf: "2026-09-30", period: { label: "Q3", start: "2026-07-01", end: "2026-09-30" }, sources: [], donors: [], gifts: [], participants: [], attendance: [], volunteerHours: [], paymentFailures: [], candidates: [], drafts: [], runs: [], audit: [], grants: [], expenses: [], notes: [], disclosures: [], outbox: [] },
    metrics: [], queue: [], liveAvailable: false, ledgers: [],
  };
}

test("empty records produce the explicit empty view on all four routes", () => {
  for (const map of [overviewCards, inboxCards, grantsCards, counselingCards]) assert.deepEqual(map(emptyDashboard()), []);
});

test("grants summary excludes follow-ups and uses grant source evidence", () => {
  const dashboard = emptyDashboard();
  dashboard.state.grants.push({ id: "grant", name: "Fictional funder", fiscalStart: "2026-01-01", fiscalEnd: "2026-12-31", applicationQuestion: "Why?", wordLimit: 100, categories: [], allowedNoteFields: [], sourceIds: ["rules"] });
  dashboard.state.drafts = ["followup", "report", "application"].map((kind, index) => ({ id: String(index), kind }) as Draft);
  const cards = grantsCards(dashboard);
  assert.equal(cards.find((card) => card.id === "report-drafts")?.value, "1");
  assert.equal(cards.find((card) => card.id === "application-drafts")?.value, "1");
  assert.deepEqual(cards[0].sourceIds, ["rules"]);
});

test("counseling views whitelist summary metadata even if given unexpected fields", () => {
  const dashboard = emptyDashboard();
  const note = { id: "note", familyCode: "F-01", grantId: "grant", payable: false, date: "2026-09-01", counselor: "Fictional counselor", privateDetail: "PRIVATE_SENTINEL", goal: "Private goal", progress: "Private progress" };
  dashboard.state.notes.push(note);
  const cards = counselingCards(dashboard);
  assert.equal(JSON.stringify(cards).includes("PRIVATE_SENTINEL"), false);
  assert.equal(JSON.stringify(cards).includes("Private goal"), false);
  assert.equal(cards[0].detail, "Fictional counselor · Not payable");
  assert.equal(cards[0].sourceIds, undefined);
});

test("overview uses server metrics and preserves their evidence IDs", () => {
  const dashboard = emptyDashboard();
  dashboard.metrics.push({ id: "giving", label: "Giving", value: 12.34, unit: "USD", sourceIds: ["gift-row"] });
  assert.deepEqual(overviewCards(dashboard), [{ id: "giving", label: "Giving", value: "$12.34", detail: "In this quarter", sourceIds: ["gift-row"] }]);
});
