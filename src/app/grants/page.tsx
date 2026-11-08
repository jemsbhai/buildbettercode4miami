"use client";

import { useState } from "react";
import WorkspaceShell from "@/components/layout/workspace-shell";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";
import { GrantsWorkspace } from "@/components/grants-workspace";
import { ReportWorkspace } from "@/components/report-workspace";

export default function Page() {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence, onError, generateReport, generateApplication, saveDraft, approveDraft, sendDraft, addExpense } = useWorkspaceData();
  return <WorkspaceShell title="Every grant, on its own terms." description="Keep quarterly reports, applications and spending together." {...shell}>
    {dashboard ? <div className="workspace-content">
      <ReportWorkspace dashboard={dashboard} kinds={["report", "application"]} selectedDraftId={selectedDraftId} onSelectDraft={setSelectedDraftId} onGenerateReport={generateReport} onSaveDraft={saveDraft} onApproveDraft={approveDraft} onSendDraft={sendDraft} onError={onError} onEvidence={onEvidence} />
      <GrantsWorkspace dashboard={dashboard} onGenerateApplication={generateApplication} onAddExpense={addExpense} onError={onError} onEvidence={onEvidence} onDrafted={(draft) => setSelectedDraftId(draft.id)} />
    </div> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
