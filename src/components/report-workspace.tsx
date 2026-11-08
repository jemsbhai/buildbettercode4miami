"use client";

import { useState } from "react";
import { ArrowRight, Check, FileCheck2, FileText, Link2, LoaderCircle, Sparkles } from "lucide-react";
import type { Dashboard, Draft } from "@/lib/types";
import { apiRequest, errorMessage } from "./client-api";
import DraftEditor, { type DraftEditorProps } from "@/components/shared/drafts/draft-editor";

type Props = {
  dashboard: Dashboard;
  mode: "demo" | "live";
  onUpdate: (dashboard: Dashboard) => void;
  onError: (message: string) => void;
  onEvidence: (ids: string[], title: string) => void;
  selectedDraftId: string | null;
  onSelectDraft: (id: string) => void;
};

export function ReportWorkspace({ dashboard, mode, onUpdate, onError, onEvidence, selectedDraftId, onSelectDraft }: Props) {
  const [generating, setGenerating] = useState(false);
  const drafts = dashboard.state.drafts;
  const selected = drafts.find((draft) => draft.id === selectedDraftId) ?? drafts.at(-1);
  const run = dashboard.state.runs.find((run) => run.id === selected?.runId);

  async function generate() {
    setGenerating(true); onError("");
    try {
      const result = await apiRequest<{ draft: Draft; dashboard: Dashboard }>("/api/drafts", "POST", { kind: "report", mode });
      onUpdate(result.dashboard); onSelectDraft(result.draft.id);
    } catch (err) { onError(errorMessage(err)); } finally { setGenerating(false); }
  }

  // Temporary adapters: the shared editor is props-only; these keep the legacy
  // fetch pattern out of it. Page-owned hook callbacks replace these adapters.
  const saveDraft: DraftEditorProps["onSaveDraft"] = async (draftId, revision, narrative, claims) => {
    const result = await apiRequest<{ draft: Draft; dashboard: Dashboard }>(`/api/drafts/${draftId}`, "PATCH", { narrative, claims, revision });
    onUpdate(result.dashboard);
    return result.draft;
  };
  const approveDraft: DraftEditorProps["onApproveDraft"] = async (draftId, revision) => {
    const result = await apiRequest<{ draft: Draft; dashboard: Dashboard }>(`/api/drafts/${draftId}/approve`, "POST", { revision });
    onUpdate(result.dashboard);
    return result.draft;
  };
  const sendDraft: DraftEditorProps["onSendDraft"] = async (draftId, revision) => {
    const result = await apiRequest<{ dashboard: Dashboard }>(`/api/drafts/${draftId}/send`, "POST", { revision });
    onUpdate(result.dashboard);
  };

  return <div className="workspace-content">
    <section className="report-intro panel"><div><span className="eyebrow">FROM RECORD TO REPORT</span><h2>Let the evidence do the talking.</h2><p>Build a quarterly summary from the same records your team uses every day. Staff approval stays with you.</p></div><button className="button button-primary" disabled={generating} onClick={generate}>{generating ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{generating ? "Preparing your draft…" : "Draft quarterly report"}</button></section>
    <div className="report-grid">
      <aside className="panel draft-library"><div className="panel-heading"><h2>Your drafts</h2><span className="pill pill-neutral">{drafts.length}</span></div><div className="draft-list">{[...drafts].reverse().map((draft) => <button className={`draft-list-item ${selected?.id === draft.id ? "selected" : ""}`} key={draft.id} onClick={() => onSelectDraft(draft.id)}><span className="draft-type-icon">{draft.kind === "report" ? <FileCheck2 size={19} /> : <FileText size={19} />}</span><span><strong>{draft.title}</strong><small>{draft.mode === "live" ? "Live agent" : "Demo template"} · Revision {draft.revision}</small><span className={`draft-status ${draft.status === "approved" ? "approved" : ""}`}>{draft.status === "approved" ? "Approved" : "Needs review"}</span></span><ArrowRight size={15} /></button>)}</div>{!drafts.length ? <p className="library-empty">Draft a report here, or start a follow-up from People & actions.</p> : null}</aside>
      {selected ? <div className="report-main"><DraftEditor key={selected.id} draft={selected} dashboard={dashboard} onError={onError} onEvidence={onEvidence} onSaveDraft={saveDraft} onApproveDraft={approveDraft} onSendDraft={sendDraft} />
        <section className="panel run-panel"><div className="panel-heading"><div><span className="eyebrow">A VISIBLE PROCESS</span><h2>How this draft came together</h2></div><span className="pill pill-neutral">{run?.mode === "live" ? "Live agent run" : "Recorded demo run"}</span></div>{run ? <><div className="run-meta"><span>{run.model}</span><span>{run.inputTokens + run.outputTokens} tokens</span><span>{(run.durationMs / 1000).toFixed(1)}s</span><span>Up to {run.maxTurns} turns</span></div><ol className="run-events">{run.events.map((event) => <li key={event.id}><span className="timeline-point"><Check size={12} /></span><div><strong>{event.action.replaceAll("_", " ")}</strong><p>{event.detail}</p>{event.sourceIds.length ? <button className="text-button" onClick={() => onEvidence(event.sourceIds, event.action)}><Link2 size={13} />View evidence</button> : null}</div></li>)}</ol></> : <p className="empty-state">Run details are not available for this draft.</p>}</section>
      </div> : <div className="panel report-empty"><span className="empty-art"><FileCheck2 size={42} strokeWidth={1.3} /></span><h2>A clear story starts with good records.</h2><p>Generate your first quarterly report. You can inspect the source behind each figure, edit the draft, and approve it when you’re ready.</p><div className="report-steps"><span><span>1</span>Gather evidence</span><span><span>2</span>Review the draft</span><span><span>3</span>Approve & export</span></div></div>}
    </div>
  </div>;
}
