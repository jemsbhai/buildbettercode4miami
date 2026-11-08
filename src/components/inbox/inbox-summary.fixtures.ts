import type { InboxSummaryProps } from "./inbox-summary";

// Fictional view-only props. Never imported by production pages.
export const populated = {
  cards: [{ id: "fixture-inbox", label: "Fictional inbox summary", value: "3", detail: "Synthetic fixture for view development", sourceIds: ["fixture-source"] }],
  onEvidence: (_ids: string[], _title: string) => {},
} satisfies InboxSummaryProps;

export const empty = { cards: [], onEvidence: populated.onEvidence } satisfies InboxSummaryProps;

// Evidence is unavailable, so the view offers no evidence action.
export const unavailable = { cards: [{ id: "unavailable", label: "Evidence unavailable", value: "—" }] } satisfies InboxSummaryProps;
