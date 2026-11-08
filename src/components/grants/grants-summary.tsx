import SummaryPanel, { type SummaryCard, type SummaryPanelProps } from "@/components/shared/summary/summary-panel";

export type GrantsSummaryProps = {
  cards: SummaryCard[];
  onEvidence?: SummaryPanelProps["onEvidence"];
};

export default function GrantsSummary({ cards, onEvidence }: GrantsSummaryProps) {
  return <SummaryPanel title="Grants and quarterly reports" description="Reports, applications and spending share this workspace." cards={cards} emptyMessage="No grants or report drafts are available." nextSteps="Report and application review, approval and download, spending entry and drafting history are not yet available in this preview." links={[]} onEvidence={onEvidence} />;
}
