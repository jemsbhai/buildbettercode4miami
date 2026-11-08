import type { SummaryCard } from "@/components/shared/summary/summary-panel";
import type { Dashboard } from "./types";
import { formatMetric } from "./format";

export function overviewCards(dashboard: Dashboard): SummaryCard[] {
  return dashboard.metrics.map((metric) => ({ id: metric.id, label: metric.label, value: formatMetric(metric.value, metric.unit), detail: metric.unit === "USD" ? "In this quarter" : metric.unit, sourceIds: metric.sourceIds }));
}

export function inboxCards(dashboard: Dashboard): SummaryCard[] {
  const { state, queue } = dashboard;
  // An empty record should render the view's explicit empty state rather than zero cards.
  if (!state.gifts.length && !state.candidates.length && !state.attendance.length && !queue.length) return [];
  return [
    { id: "gifts", label: "Gift records", value: String(state.gifts.length), detail: "All gift records in this snapshot" },
    { id: "duplicates", label: "Duplicate reviews pending", value: String(state.candidates.filter((item) => item.status === "pending").length) },
    { id: "followups", label: "Follow-ups open", value: String(queue.filter((item) => item.status === "open").length) },
    { id: "attendance", label: "Attendance records", value: String(state.attendance.length) },
  ];
}

export function grantsCards(dashboard: Dashboard): SummaryCard[] {
  const cards: SummaryCard[] = dashboard.state.grants.map((grant) => ({ id: grant.id, label: grant.name, value: `${grant.fiscalStart} – ${grant.fiscalEnd}`, detail: "Funder year · spending details will be connected here", sourceIds: grant.sourceIds }));
  const reports = dashboard.state.drafts.filter((draft) => draft.kind === "report");
  const applications = dashboard.state.drafts.filter((draft) => draft.kind === "application");
  if (cards.length || reports.length || applications.length) cards.push(
    { id: "report-drafts", label: "Quarterly report drafts", value: String(reports.length) },
    { id: "application-drafts", label: "Application drafts", value: String(applications.length) },
  );
  return cards;
}

export function counselingCards(dashboard: Dashboard): SummaryCard[] {
  return dashboard.state.notes.map((note) => ({ id: note.id, label: `Family ${note.familyCode}`, value: note.date, detail: `${note.counselor} · ${note.payable ? "Payable session" : "Not payable"}` }));
}
