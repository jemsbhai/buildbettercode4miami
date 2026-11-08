import type { SourceRow } from "@/lib/types";

export const populated = {
  title: "Fictional evidence",
  sources: [{ id: "fixture-source", source: "fictional.csv", row: 1, values: { description: "Synthetic source row", amount_cents: 1200 }, importedAt: "2026-09-30T12:00:00Z" }] satisfies SourceRow[],
  onClose: () => {},
};
export const empty = { ...populated, sources: [] };
