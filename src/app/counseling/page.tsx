"use client";

import WorkspaceShell from "@/components/layout/workspace-shell";
import CounselingSummary from "@/components/counseling/counseling-summary";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";
import { counselingCards } from "@/lib/workspace-summaries";

export default function Page() {
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence } = useWorkspaceData();
  return <WorkspaceShell title="Write it once. Share with care." description="Start with session summaries; private notes stay closed." {...shell}>
    {dashboard ? <CounselingSummary cards={counselingCards(dashboard)} onEvidence={onEvidence} /> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
