import SummaryPanel, { type SummaryCard, type SummaryPanelProps } from "@/components/shared/summary/summary-panel";

export type InboxSummaryProps = {
  cards: SummaryCard[];
  onEvidence?: SummaryPanelProps["onEvidence"];
};

export default function InboxSummary({ cards, onEvidence }: InboxSummaryProps) {
  return <SummaryPanel title="Incoming records and follow-ups" description="A summary of the work waiting in the shared record." cards={cards} emptyMessage="No inbox records are available." nextSteps="Gift import, duplicate review, attendance entry and follow-up drafting are not yet available in this preview." links={[]} onEvidence={onEvidence} />;
}
