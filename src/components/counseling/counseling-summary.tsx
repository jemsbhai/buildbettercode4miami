import SummaryPanel, { type SummaryCard, type SummaryPanelProps } from "@/components/shared/summary/summary-panel";

export type CounselingSummaryProps = {
  cards: SummaryCard[];
  onEvidence?: SummaryPanelProps["onEvidence"];
};

export default function CounselingSummary({ cards, onEvidence }: CounselingSummaryProps) {
  return <SummaryPanel title="Counseling session summaries" description="Only session metadata is shown here. Full notes have not been opened." cards={cards} emptyMessage="No counseling sessions are available." nextSteps="Opening and editing notes, reviewing the exact funder copy, approval and export are not yet available in this preview." links={[]} onEvidence={onEvidence} />;
}
