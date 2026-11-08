"use client";

import { useState } from "react";
import WorkspaceShell from "@/components/layout/workspace-shell";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import DraftEditor from "@/components/shared/drafts/draft-editor";
import Modal from "@/components/shared/layout/modal";
import ToastNotice from "@/components/shared/notice/toast-notice";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";
import { GrantsWorkspace } from "@/components/grants-workspace";
import { ReportWorkspace } from "@/components/report-workspace";

export default function Page() {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [applicationDraftId, setApplicationDraftId] = useState<string | null>(null);
  const [reportModalId, setReportModalId] = useState<string | null>(null);
  const [approvePulse, setApprovePulse] = useState(false);
  const [approveNotice, setApproveNotice] = useState("");
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence, onError, generateReport, generateApplication, saveDraft, approveDraft, sendDraft, addExpense } = useWorkspaceData();
  const applicationDraft = dashboard?.state.drafts.find((draft) => draft.id === applicationDraftId && draft.kind === "application");
  const reportDraft = dashboard?.state.drafts.find((draft) => draft.id === reportModalId && draft.kind === "report");
  const applicationGrant = dashboard?.state.grants.find((grant) => grant.id === applicationDraft?.grantId);
  const approveWithPulse = async (draftId: string, revision: number) => {
    const draft = await approveDraft(draftId, revision);
    setApprovePulse(true);
    setTimeout(() => setApprovePulse(false), 850);
    setApproveNotice("Approved. This exact revision is ready to export.");
    return draft;
  };
  return <WorkspaceShell title="Every grant, on its own terms." description="Keep quarterly reports, applications and spending together." {...shell}>
    {dashboard ? <div className="workspace-content">
      <ReportWorkspace dashboard={dashboard} kinds={["report"]} selectedDraftId={selectedDraftId} onSelectDraft={(id) => { setSelectedDraftId(id); setReportModalId(id); }} onGenerateReport={async () => { const draft = await generateReport(); setReportModalId(draft.id); return draft; }} onError={onError} onEvidence={onEvidence} />
      <GrantsWorkspace dashboard={dashboard} onGenerateApplication={generateApplication} onAddExpense={addExpense} onError={onError} onEvidence={onEvidence} onDrafted={(draft) => setApplicationDraftId(draft.id)} />
    </div> : null}
    {dashboard && applicationDraft ? <Modal title="Application review" pulse={approvePulse} onClose={() => { setApplicationDraftId(null); setApproveNotice(""); }}>
      {approveNotice ? <ToastNotice message={approveNotice} autoDismiss={false} onDismiss={() => setApproveNotice("")} /> : null}
      <DraftEditor draft={applicationDraft} dashboard={dashboard} subject={applicationGrant?.name} onError={onError} onEvidence={onEvidence} onSaveDraft={saveDraft} onApproveDraft={approveWithPulse} onSendDraft={sendDraft} />
    </Modal> : null}
    {dashboard && reportDraft ? <Modal title="Report review" pulse={approvePulse} onClose={() => { setReportModalId(null); setApproveNotice(""); }}>
      {approveNotice ? <ToastNotice message={approveNotice} autoDismiss={false} onDismiss={() => setApproveNotice("")} /> : null}
      <DraftEditor draft={reportDraft} dashboard={dashboard} onError={onError} onEvidence={onEvidence} onSaveDraft={saveDraft} onApproveDraft={approveWithPulse} onSendDraft={sendDraft} />
    </Modal> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
