"use client";

import WorkspaceShell from "@/components/layout/workspace-shell";
import OverviewSummary from "@/components/dashboard/dashboard-summary";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";
import { overviewCards } from "@/lib/workspace-summaries";

export default function Page() {
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence } = useWorkspaceData();
  return <WorkspaceShell title="A little clarity. A way forward." description="Your shared record, with a route to each next step." {...shell}>
    {dashboard ? <OverviewSummary cards={overviewCards(dashboard)} onEvidence={onEvidence} /> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
