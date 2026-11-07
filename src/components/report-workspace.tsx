"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, Download, FileCheck2, FileText, Link2, LoaderCircle, Save, Send, Sparkles } from "lucide-react";
import type { Claim, Dashboard, Draft, ValidationIssue } from "@/lib/types";
import { ApiError, apiRequest, errorMessage, formatMetric } from "./client-api";

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

  return <div className="workspace-content">
    <section className="report-intro panel"><div><span className="eyebrow">FROM RECORD TO REPORT</span><h2>Let the evidence do the talking.</h2><p>Build a quarterly summary from the same records your team uses every day. Staff approval stays with you.</p></div><button className="button button-primary" disabled={generating} onClick={generate}>{generating ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{generating ? "Preparing your draft…" : "Draft quarterly report"}</button></section>
    <div className="report-grid">
      <aside className="panel draft-library"><div className="panel-heading"><h2>Your drafts</h2><span className="pill pill-neutral">{drafts.length}</span></div><div className="draft-list">{[...drafts].reverse().map((draft) => <button className={`draft-list-item ${selected?.id === draft.id ? "selected" : ""}`} key={draft.id} onClick={() => onSelectDraft(draft.id)}><span className="draft-type-icon">{draft.kind === "report" ? <FileCheck2 size={19} /> : <FileText size={19} />}</span><span><strong>{draft.title}</strong><small>{draft.mode === "live" ? "Live agent" : "Demo template"} · Revision {draft.revision}</small><span className={`draft-status ${draft.status === "approved" ? "approved" : ""}`}>{draft.status === "approved" ? "Approved" : "Needs review"}</span></span><ArrowRight size={15} /></button>)}</div>{!drafts.length ? <p className="library-empty">Draft a report here, or start a follow-up from People & actions.</p> : null}</aside>
      {selected ? <div className="report-main"><DraftEditor key={selected.id} draft={selected} dashboard={dashboard} onUpdate={onUpdate} onError={onError} onEvidence={onEvidence} />
        <section className="panel run-panel"><div className="panel-heading"><div><span className="eyebrow">A VISIBLE PROCESS</span><h2>How this draft came together</h2></div><span className="pill pill-neutral">{run?.mode === "live" ? "Live agent run" : "Recorded demo run"}</span></div>{run ? <><div className="run-meta"><span>{run.model}</span><span>{run.inputTokens + run.outputTokens} tokens</span><span>{(run.durationMs / 1000).toFixed(1)}s</span><span>Up to {run.maxTurns} turns</span></div><ol className="run-events">{run.events.map((event) => <li key={event.id}><span className="timeline-point"><Check size={12} /></span><div><strong>{event.action.replaceAll("_", " ")}</strong><p>{event.detail}</p>{event.sourceIds.length ? <button className="text-button" onClick={() => onEvidence(event.sourceIds, event.action)}><Link2 size={13} />View evidence</button> : null}</div></li>)}</ol></> : <p className="empty-state">Run details are not available for this draft.</p>}</section>
      </div> : <div className="panel report-empty"><span className="empty-art"><FileCheck2 size={42} strokeWidth={1.3} /></span><h2>A clear story starts with good records.</h2><p>Generate your first quarterly report. You can inspect the source behind each figure, edit the draft, and approve it when you’re ready.</p><div className="report-steps"><span><span>1</span>Gather evidence</span><span><span>2</span>Review the draft</span><span><span>3</span>Approve & export</span></div></div>}
    </div>
  </div>;
}

function DraftEditor({ draft, dashboard, onUpdate, onError, onEvidence }: {
  draft: Draft; dashboard: Dashboard; onUpdate: Props["onUpdate"]; onError: Props["onError"]; onEvidence: Props["onEvidence"];
}) {
  const [narrative, setNarrative] = useState(draft.narrative);
  const [claims, setClaims] = useState<Array<{ metricId: string; value: string }>>(() => draft.claims.map((claim) => ({ ...claim, value: String(claim.value) })));
  const [busy, setBusy] = useState<"save" | "approve" | "send" | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setNarrative(draft.narrative);
    setClaims(draft.claims.map((claim) => ({ ...claim, value: String(claim.value) })));
  }, [draft.narrative, draft.claims, draft.revision]);
  const dirty = narrative !== draft.narrative || claims.some((claim, index) => claim.metricId !== draft.claims[index]?.metricId || claim.value !== String(draft.claims[index]?.value));
  const stale = draft.dataRevision !== dashboard.state.revision;
  const grant = dashboard.state.grants.find((grant) => grant.id === draft.grantId);
  const renderedWords = [narrative.trim(), ...claims.map((claim) => {
    const metric = dashboard.metrics.find((item) => item.id === claim.metricId);
    const value = metric?.unit === "USD" ? formatMetric(Number(claim.value), "USD") : `${claim.value} ${metric?.unit ?? ""}`.trim();
    return `${metric?.label ?? claim.metricId}: ${value}`;
  })].filter(Boolean).join("\n").trim().split(/\s+/).filter(Boolean).length;
  const receipt = dashboard.state.outbox.find((item) => item.draftId === draft.id && item.draftRevision === draft.revision);

  async function simulateDelivery() {
    setBusy("send"); onError("");
    try {
      const result = await apiRequest<{ dashboard: Dashboard }>(`/api/drafts/${draft.id}/send`, "POST", { revision: draft.revision });
      onUpdate(result.dashboard);
    } catch (err) { onError(errorMessage(err)); } finally { setBusy(null); }
  }

  async function save(approve: boolean) {
    setBusy(approve ? "approve" : "save"); setIssues([]); setSaved(false); onError("");
    try {
      let current = draft;
      if (dirty) {
        if (claims.some((claim) => !claim.value.trim() || !Number.isFinite(Number(claim.value)))) throw new Error("Every fact needs a valid number before it can be saved.");
        const patch = await apiRequest<{ draft: Draft; dashboard: Dashboard }>(`/api/drafts/${draft.id}`, "PATCH", { narrative, claims: claims.map((claim): Claim => ({ metricId: claim.metricId, value: Number(claim.value) })), revision: draft.revision });
        onUpdate(patch.dashboard); current = patch.draft;
      }
      if (approve) {
        const result = await apiRequest<{ draft: Draft; dashboard: Dashboard }>(`/api/drafts/${draft.id}/approve`, "POST", { revision: current.revision });
        onUpdate(result.dashboard);
      }
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setIssues(err.issues);
      else onError(errorMessage(err));
    } finally { setBusy(null); }
  }

  return <section className="panel editor-panel" aria-labelledby="draft-title">
    <div className="panel-heading"><div><span className="eyebrow">{draft.kind === "report" ? "QUARTERLY REPORT" : draft.kind === "application" ? "GRANT APPLICATION" : "FOLLOW-UP DRAFT"}</span><h2 id="draft-title">{draft.title}</h2></div><span className={`pill ${draft.status === "approved" && !dirty && !stale ? "pill-green" : "pill-amber"}`}>{dirty ? "Unsaved edits" : stale ? "Record changed" : draft.status === "approved" ? "Approved" : "Needs your review"}</span></div>
    <div className="editor-body">
      <div className="draft-meta"><span>{draft.mode === "live" ? "Drafted with the OpenAI agent" : "Deterministic demo template · no model call"}</span><span>Revision {draft.revision}</span></div>
      {stale ? <div className="notice notice-warning"><AlertCircle size={18} /><span>The underlying record changed. Generate a fresh draft before approval.</span></div> : null}
      {grant ? <div className="application-context"><p>{grant.applicationQuestion}</p><span className={`pill ${renderedWords > grant.wordLimit ? "pill-coral" : "pill-green"}`}>{renderedWords} / {grant.wordLimit} words including facts</span></div> : null}
      <label className="narrative-label">The story<textarea className="narrative-editor" value={narrative} rows={draft.kind === "report" ? 7 : 5} onChange={(event) => { setNarrative(event.target.value); setSaved(false); setIssues([]); }} /><span className="field-hint">Keep numeric claims in the fact fields below so each figure can be checked against the record.</span></label>
      {claims.length ? <div className="claim-section"><div className="claim-heading"><h3>The facts behind it</h3><span>Edit a figure to see the approval check work.</span></div><div className="claims-grid">{claims.map((claim, index) => {
        const metric = dashboard.metrics.find((metric) => metric.id === claim.metricId);
        const mismatch = metric && Number(claim.value) !== metric.value;
        return <div className={`claim-card ${mismatch ? "claim-mismatch" : ""}`} key={claim.metricId}><label>{metric?.label ?? claim.metricId}<div className="claim-input-wrap">{metric?.unit === "USD" ? <span>$</span> : null}<input inputMode="decimal" type="number" step="any" value={claim.value} onChange={(event) => { setClaims((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value } : item)); setSaved(false); setIssues([]); }} /></div></label><div className="claim-check">{mismatch ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}<span>Record: {metric ? formatMetric(metric.value, metric.unit) : "Metric unavailable"}</span></div>{metric ? <button className="text-button" onClick={() => onEvidence(metric.sourceIds, metric.label)}><Link2 size={13} />Source evidence</button> : null}</div>;
      })}</div></div> : null}
      <button className="text-button" onClick={() => onEvidence(draft.sourceIds, `Evidence for ${draft.title}`)}><Link2 size={14} />View all supporting records</button>
      {issues.length ? <div className="validation-panel" role="alert"><div><AlertCircle size={19} /><h3>Approval paused. Let’s check the facts.</h3></div><ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></div> : null}
      {saved ? <p className="success-line" role="status"><CheckCircle2 size={16} />{draft.status === "approved" ? "Approved. This exact revision is ready to export." : "Your changes are saved for review."}</p> : null}
      {receipt ? <div className="simulation-receipt" role="status"><CheckCircle2 size={17} /><div><strong>Simulated delivery recorded</strong><p>{receipt.recipient} · Revision {receipt.draftRevision} · {new Date(receipt.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p><small>This is a local demo receipt. No external message was sent.</small></div></div> : null}
    </div>
    <div className="editor-actions"><p>{draft.kind === "followup" ? "Approval saves a reviewed draft. Delivery is simulated only." : "Edits require a new review before export."}</p><div><button className="button button-outline" disabled={busy !== null || !dirty} onClick={() => save(false)}>{busy === "save" ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}Save draft</button>{draft.status === "approved" && !dirty && !stale ? <><a className="button button-outline" href={`/api/drafts/${draft.id}/export`} download><Download size={16} />Export</a>{draft.kind === "followup" && !receipt ? <button className="button button-primary" disabled={busy !== null} onClick={simulateDelivery}>{busy === "send" ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}Simulate delivery</button> : null}</> : <button className="button button-primary" disabled={busy !== null || stale} onClick={() => save(true)}>{busy === "approve" ? <LoaderCircle size={15} className="spin" /> : <Check size={16} />}Check & approve</button>}</div></div>
  </section>;
}
