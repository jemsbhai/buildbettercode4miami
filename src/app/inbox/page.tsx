"use client";

import { useState } from "react";
import WorkspaceShell from "@/components/layout/workspace-shell";
import EvidenceDrawer from "@/components/shared/evidence/evidence-drawer";
import DraftEditor from "@/components/shared/drafts/draft-editor";
import Modal from "@/components/shared/layout/modal";
import { OperationsWorkspace } from "@/components/operations-workspace";
import useWorkspaceData from "@/app/_hooks/use-workspace-data";

export default function Page() {
  const { dashboard, shell, evidence, onEvidence, onCloseEvidence, onError, mergeCandidate, importGifts, saveAttendance, draftFollowup, saveDraft, approveDraft, sendDraft } = useWorkspaceData();
  const [selectedFollowupId, setSelectedFollowupId] = useState<string | null>(null);
  const followup = dashboard?.state.drafts.find((draft) => draft.id === selectedFollowupId && draft.kind === "followup");
  return <WorkspaceShell title="Bring the records together." description="See the records and follow-ups waiting for review, then draft and approve the next step." {...shell}>
    {dashboard ? <OperationsWorkspace
      dashboard={dashboard}
      onMerge={mergeCandidate}
      onImport={importGifts}
      onSaveAttendance={saveAttendance}
      onDraftFollowup={draftFollowup}
      readCsvFile={async (file) => ({ name: file.name, text: await file.text() })}
      onError={onError}
      onEvidence={onEvidence}
      onDrafted={(draft) => setSelectedFollowupId(draft.id)}
    /> : null}
    {dashboard && followup ? <Modal title="Follow-up review" onClose={() => setSelectedFollowupId(null)}>
      <DraftEditor
        draft={followup}
        dashboard={dashboard}
        onError={onError}
        onEvidence={onEvidence}
        onSaveDraft={saveDraft}
        onApproveDraft={approveDraft}
        onSendDraft={sendDraft}
      />
    </Modal> : null}
    {evidence ? <EvidenceDrawer {...evidence} onClose={onCloseEvidence} /> : null}
  </WorkspaceShell>;
}
