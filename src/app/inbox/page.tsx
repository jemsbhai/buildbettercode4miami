"use client";

import WorkspaceShell from "@/components/layout/workspace-shell";
import InboxSummary from "@/components/inbox/inbox-summary";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";
import { inboxCards } from "@/lib/workspace-summaries";

export default function Page() {
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence } = useWorkspaceData();
  return <WorkspaceShell title="Bring the records together." description="See the records and follow-ups waiting for review." {...shell}>
    {dashboard ? <InboxSummary cards={inboxCards(dashboard)} onEvidence={onEvidence} /> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
