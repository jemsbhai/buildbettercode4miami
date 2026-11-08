import SummaryPanel, { type SummaryCard, type SummaryPanelProps } from "@/components/shared/summary/summary-panel";

export type OverviewSummaryProps = {
  cards: SummaryCard[];
  onEvidence?: SummaryPanelProps["onEvidence"];
};

export default function OverviewSummary({ cards, onEvidence }: OverviewSummaryProps) {
  return <SummaryPanel title="Quarter at a glance" description="Source-backed figures from the shared record." cards={cards} emptyMessage="No metrics are available for this quarter." nextSteps="This preview shows the shared figures. More detailed work summaries are coming next." links={[{"href": "/inbox", "label": "Review the inbox"}, {"href": "/grants", "label": "View grants and reports"}, {"href": "/counseling", "label": "View counseling sessions"}]} onEvidence={onEvidence} />;
}
