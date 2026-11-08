import type { CounselingSummaryProps } from "./counseling-summary";

// Fictional view-only props. Never imported by production pages.
export const populated = {
  cards: [{ id: "fixture-counseling", label: "Fictional counseling summary", value: "3", detail: "Synthetic fixture for view development", sourceIds: ["fixture-source"] }],
  onEvidence: (_ids: string[], _title: string) => {},
} satisfies CounselingSummaryProps;

export const empty = { cards: [], onEvidence: populated.onEvidence } satisfies CounselingSummaryProps;

// Evidence is unavailable, so the view offers no evidence action.
export const unavailable = { cards: [{ id: "unavailable", label: "Evidence unavailable", value: "—" }] } satisfies CounselingSummaryProps;
