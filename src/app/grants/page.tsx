"use client";

import WorkspaceShell from "@/components/layout/workspace-shell";
import GrantsSummary from "@/components/grants/grants-summary";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";
import { grantsCards } from "@/lib/workspace-summaries";

export default function Page() {
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence } = useWorkspaceData();
  return <WorkspaceShell title="Every grant, on its own terms." description="Keep quarterly reports, applications and spending together." {...shell}>
    {dashboard ? <GrantsSummary cards={grantsCards(dashboard)} onEvidence={onEvidence} /> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
