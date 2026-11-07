import type { Donor } from "./types";

/** The configured date anchors the recurrence; short months clamp without drifting. */
function anniversary(anchor: string, offset: number, cadence: "monthly" | "annual"): string {
  const [year, month, day] = anchor.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year + (cadence === "annual" ? offset : 0), month - 1 + (cadence === "monthly" ? offset : 0), 1);
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, last.getUTCDate()));
  return date.toISOString().slice(0, 10);
}

/**
 * Only the latest due cycle is actionable. A payment fulfills its cycle, never all
 * future cycles. Legacy January annual anchors mean December giving with a January
 * grace date; other anchors are literal due dates. No cadence is inferred from gifts.
 */
export function currentGivingCycle(donor: Donor, asOf: string): { due: string; start: string; end: string; decemberGrace: boolean } | undefined {
  if (!donor.cadence || !donor.expectedAt || donor.expectedAt > asOf) return;
  const [year, month] = donor.expectedAt.split("-").map(Number);
  const [asOfYear, asOfMonth] = asOf.split("-").map(Number);
  let offset = donor.cadence === "monthly" ? (asOfYear - year) * 12 + asOfMonth - month : asOfYear - year;
  if (anniversary(donor.expectedAt, offset, donor.cadence) > asOf) offset--;
  if (offset < 0) return;
  const due = anniversary(donor.expectedAt, offset, donor.cadence);
  const next = anniversary(donor.expectedAt, offset + 1, donor.cadence);
  const decemberGrace = donor.cadence === "annual" && donor.expectedAt.endsWith("-01-01");
  return {
    due,
    start: decemberGrace ? `${Number(due.slice(0, 4)) - 1}-12-01` : due,
    end: decemberGrace ? `${Number(next.slice(0, 4)) - 1}-12-01` : next,
    decemberGrace,
  };
}
