"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CircleDollarSign, ClipboardCheck, FileCheck2, HeartHandshake, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Waves, X } from "lucide-react";
import type { Dashboard, Draft } from "@/lib/types";
import { apiRequest, errorMessage } from "./client-api";
import { EvidenceDrawer } from "./evidence-drawer";
import { OperationsWorkspace } from "./operations-workspace";
import { ReportWorkspace } from "./report-workspace";
import { GrantsWorkspace } from "./grants-workspace";
import { DisclosureWorkspace } from "./disclosure-workspace";

const tabs = {
  operations: { label: "People & actions", title: "A little clarity. A way forward.", description: "Bring the records together. See who needs you next." },
  reports: { label: "Reports & review", title: "A report you can stand behind.", description: "Draft from the record, check every figure, then give your approval." },
  grants: { label: "Grants & spending", title: "Every grant, on its own terms.", description: "Keep the funding, the facts, and the funder’s rules together." },
  counseling: { label: "Counseling notes", title: "Write it once. Share with care.", description: "A clear boundary between a private note and a funder’s copy." },
};

export function TidepathDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<keyof typeof tabs>("operations");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ ids: string[]; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<Dashboard>("/api/dashboard").then((data) => { if (active) setDashboard(data); })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function reset() {
    if (!window.confirm("Reset this synthetic demo? This removes imported demo rows, reviews, drafts, and run history, and restores the starting scenario.")) return;
    setResetting(true); setError("");
    try {
      setDashboard(await apiRequest<Dashboard>("/api/reset", "POST"));
      setSelectedDraftId(null); setTab("operations"); setEvidence(null);
    } catch (err) { setError(errorMessage(err)); } finally { setResetting(false); }
  }

  function openDraft(draft: Draft) { setSelectedDraftId(draft.id); setTab("reports"); }
  const pending = dashboard?.state.candidates.filter((candidate) => candidate.status === "pending").length ?? 0;
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Tidepath home"><span className="brand-mark"><Waves size={28} strokeWidth={1.8} /></span><span>Tidepath<span className="brand-sub">FAMILY ALLIANCE</span></span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Workspace"><button className={`nav-item ${tab === "operations" ? "active" : ""}`} onClick={() => setTab("operations")} aria-label="People & actions" aria-current={tab === "operations" ? "page" : undefined}><HeartHandshake size={19} />People & actions{pending ? <span className="nav-count">{pending}</span> : null}</button>
        <button className={`nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")} aria-label="Reports & review" aria-current={tab === "reports" ? "page" : undefined}><FileCheck2 size={19} />Reports & review</button>
        <button className={`nav-item ${tab === "grants" ? "active" : ""}`} onClick={() => setTab("grants")} aria-label="Grants & spending" aria-current={tab === "grants" ? "page" : undefined}><CircleDollarSign size={19} />Grants & spending</button>
        <button className={`nav-item ${tab === "counseling" ? "active" : ""}`} onClick={() => setTab("counseling")} aria-label="Counseling notes" aria-current={tab === "counseling" ? "page" : undefined}><LockKeyhole size={19} />Counseling notes</button></nav>
      <div className="sidebar-note"><ShieldCheck size={22} /><strong>Good work deserves<br />a clear record.</strong><p>Every number has a source.<br />Every action has a reviewer.</p></div>
      <div className="sidebar-footer"><span className="avatar">TF</span><div><strong>Tidepath demo team</strong><small>Miami-Dade, Florida</small></div><ArrowUpRight size={15} /></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><span className="topbar-crumb">Workspace <span>/</span> {tabs[tab].label}</span><span className="demo-badge"><span />SYNTHETIC DEMO</span></header>
      <main id="main-content">
        <div className="page-heading"><div><span className="eyebrow">LESS ADMIN. MORE HUMAN.</span><h1>{tabs[tab].title}</h1><p>{tabs[tab].description}</p></div><button className="button button-quiet reset-button" onClick={reset} disabled={!dashboard || resetting}><RotateCcw size={15} className={resetting ? "spin" : ""} />Reset demo</button></div>

        <div className="context-bar"><div><ClipboardCheck size={16} /><strong>{dashboard?.state.period.label ?? "Loading quarter"}</strong><span className="context-detail">{dashboard ? `Record as of ${dashboard.state.asOf.slice(0, 10)}` : "One shared record"}</span></div><label className="mode-select">Drafting mode<select value={mode} onChange={(event) => setMode(event.target.value as "demo" | "live")}><option value="demo">Demo · no model call</option><option value="live" disabled={!dashboard?.liveAvailable}>Live · OpenAI agent{dashboard && !dashboard.liveAvailable ? " (key needed)" : ""}</option></select></label></div>

        {error ? <div role="alert" className="notice notice-error"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div> : null}
        {loading ? <div className="loading-state"><LoaderCircle className="spin" size={26} /><h2>Bringing your records together</h2><p>Loading the synthetic quarter.</p></div> : null}
        {!loading && !dashboard ? <div className="empty-state"><h2>The workspace could not load.</h2><p>Check that the local server is running, then refresh this page.</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></div> : null}
        {dashboard && tab === "operations" ? <OperationsWorkspace dashboard={dashboard} mode={mode} onUpdate={setDashboard} onError={setError} onEvidence={(ids, title) => setEvidence({ ids, title })} onDraft={openDraft} /> : null}
        {dashboard && tab === "reports" ? <ReportWorkspace dashboard={dashboard} mode={mode} onUpdate={setDashboard} onError={setError} onEvidence={(ids, title) => setEvidence({ ids, title })} selectedDraftId={selectedDraftId} onSelectDraft={setSelectedDraftId} /> : null}
        {dashboard && tab === "grants" ? <GrantsWorkspace dashboard={dashboard} mode={mode} onUpdate={setDashboard} onError={setError} onEvidence={(ids, title) => setEvidence({ ids, title })} onDraft={openDraft} /> : null}
        {dashboard && tab === "counseling" ? <DisclosureWorkspace dashboard={dashboard} onUpdate={setDashboard} onError={setError} /> : null}
        <footer className="main-footer"><span>Built for the people who show up for their community.</span><span>Fictional people and gifts · No external messages sent</span></footer>
      </main>
    </div>
    {evidence && dashboard ? <EvidenceDrawer title={evidence.title} ids={evidence.ids} sources={dashboard.state.sources} onClose={() => setEvidence(null)} /> : null}
  </div>;
}
