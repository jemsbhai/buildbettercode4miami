import type { DemoState, SourceRow } from "./types";
import { detectMergeCandidates } from "./domain";
import { addProgramSeed } from "./programs";

/** Entirely fictional, fixed-date fixture. Re-running creates identical source records. */
export function createSeed(): DemoState {
  const state: DemoState = {
    schemaVersion: 1, revision: 1, asOf: "2026-09-30",
    period: { label: "Q3 2026", start: "2026-07-01", end: "2026-09-30" },
    sources: [], donors: [], gifts: [], participants: [], attendance: [],
    volunteerHours: [], paymentFailures: [], candidates: [], drafts: [], runs: [], audit: [],
    grants: [], expenses: [], notes: [], disclosures: [], outbox: [],
  };
  const counters: Record<string, number> = {};
  function source(id: string, file: string, values: SourceRow["values"]): string[] {
    counters[file] = (counters[file] ?? 1) + 1;
    state.sources.push({ id, source: file, row: counters[file], values, importedAt: "2026-09-30T09:00:00.000Z" });
    return [id];
  }
  const donorData = [
    { id: "donor-rosa-online", name: "Rosa Delgado", emails: ["rosa@example.test"], phone: "+1-305-555-0101", file: "online.csv" },
    { id: "donor-rosa-tickets", name: "Rosa M. Delgado", emails: ["rosa@example.test", "rosa.work@example.test"], phone: "+1-305-555-0101", file: "tickets.csv" },
    { id: "donor-rosa-auction", name: "R. Delgado", emails: ["rosa.work@example.test"], phone: "", file: "auction.csv" },
    { id: "donor-rosa-other", name: "Rosa Delgado", emails: ["another.rosa@example.test"], phone: "+1-305-555-0199", file: "checks.csv" },
    { id: "donor-jules", name: "Jules Pierre", emails: ["jules@example.test"], phone: "+1-305-555-0112", file: "online.csv", cadence: "monthly" as const, expectedAt: "2026-09-28" },
    { id: "donor-ana", name: "Ana Torres", emails: ["ana@example.test"], phone: "+1-305-555-0123", file: "donor-history.csv", cadence: "annual" as const, expectedAt: "2026-01-01" },
  ];
  for (const { file, ...donor } of donorData) {
    state.donors.push({ ...donor, sourceIds: source(`src-${donor.id}`, file, {
      donor_id: donor.id, name: donor.name, email: donor.emails.join(";"), phone: donor.phone,
      ...(donor.cadence ? { cadence: donor.cadence, expected_at: donor.expectedAt! } : {}),
    }) });
  }
  const giftData = [
    { id: "gift-online-101", donorId: "donor-rosa-online", amountCents: 12500, date: "2026-07-10", channel: "online" as const },
    { id: "gift-ticket-201", donorId: "donor-rosa-tickets", amountCents: 8000, date: "2026-08-03", channel: "tickets" as const },
    { id: "gift-auction-301", donorId: "donor-rosa-auction", amountCents: 25000, date: "2026-09-06", channel: "auction" as const },
    { id: "gift-check-401", donorId: "donor-rosa-online", amountCents: 5000, date: "2026-09-20", channel: "check" as const },
    { id: "gift-check-402", donorId: "donor-rosa-other", amountCents: 3000, date: "2026-09-21", channel: "check" as const },
    { id: "gift-jules-july", donorId: "donor-jules", amountCents: 5000, date: "2026-07-28", channel: "online" as const },
    { id: "gift-jules-august", donorId: "donor-jules", amountCents: 5000, date: "2026-08-28", channel: "online" as const },
    { id: "gift-ana-2023", donorId: "donor-ana", amountCents: 50000, date: "2023-12-15", channel: "check" as const },
    { id: "gift-ana-2024", donorId: "donor-ana", amountCents: 50000, date: "2024-12-15", channel: "check" as const },
  ];
  for (const gift of giftData) {
    state.gifts.push({ ...gift, sourceIds: source(`src-${gift.id}`, gift.date < state.period.start ? "donor-history.csv" : `${gift.channel}.csv`, {
      gift_id: gift.id, donor_id: gift.donorId, amount_cents: gift.amountCents, date: gift.date, channel: gift.channel,
    }) });
  }
  state.paymentFailures.push({ id: "failure-jules", donorId: "donor-jules", date: "2026-09-28", reason: "expired_card",
    sourceIds: source("src-failure-jules", "payment-failures.csv", { donor_id: "donor-jules", date: "2026-09-28", reason: "expired_card" }) });
  const people = [
    { id: "participant-lucia", name: "Lucia Morales", guardian: "Elena Morales", mentor: "Sam Rivera" },
    { id: "participant-mateo", name: "Mateo Baptiste", guardian: "Nadine Baptiste", mentor: "Alex Cruz" },
    { id: "participant-isabel", name: "Isabel Chen", guardian: "Marina Chen", mentor: "Sam Rivera" },
    { id: "participant-daniel", name: "Daniel Santos", guardian: "Luis Santos", mentor: "Alex Cruz" },
  ];
  for (const person of people) {
    state.participants.push({ ...person, sourceIds: [
      ...source(`src-signup-${person.id}`, "signups.csv", { participant_id: person.id, name: person.name, guardian: person.guardian, signup_date: "2026-07-01" }),
      ...source(`src-match-${person.id}`, "mentor-matches.csv", { participant_id: person.id, mentor: person.mentor, start_date: "2026-07-01" }),
    ] });
  }
  for (let week = 0; week < 13; week++) {
    const date = new Date(Date.UTC(2026, 6, 3 + week * 7)).toISOString().slice(0, 10);
    for (const person of people) {
      const status = person.id === "participant-lucia" && week >= 11 ? "absent" : "present";
      const id = `attendance-${person.id}-${week + 1}`;
      state.attendance.push({ id, participantId: person.id, date, status,
        sourceIds: source(`src-${id}`, "attendance.csv", { participant_id: person.id, date, status }) });
    }
    for (const volunteer of ["Sam Rivera", "Alex Cruz"]) {
      const id = `hours-${volunteer.split(" ")[0].toLowerCase()}-${week + 1}`;
      state.volunteerHours.push({ id, volunteer, date, hours: 2.5,
        sourceIds: source(`src-${id}`, "volunteer-hours.csv", { volunteer, date, hours: 2.5 }) });
    }
  }
  for (const item of [
    { id: "cancelled-lucia", date: "2026-09-28", status: "cancelled" as const },
    { id: "future-lucia", date: "2026-10-02", status: "scheduled" as const },
  ]) {
    state.attendance.push({ ...item, participantId: "participant-lucia", sourceIds: source(`src-${item.id}`, "attendance.csv", { participant_id: "participant-lucia", date: item.date, status: item.status }) });
  }
  state.candidates = detectMergeCandidates(state);
  state.audit.push({ id: "audit-seed", at: "2026-09-30T09:00:00.000Z", action: "demo.loaded", detail: "Fictional Q3 fixture loaded. Historical annual lapse is retrospective; no outreach has been sent.", sourceIds: [] });
  addProgramSeed(state);
  return state;
}
