"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, CircleDollarSign, Link2, LoaderCircle, Sparkles } from "lucide-react";
import type { Dashboard, Draft, Expense } from "@/lib/types";
import { apiRequest, errorMessage, formatMetric } from "./client-api";

type Props = { dashboard: Dashboard; mode: "demo" | "live"; onUpdate: (data: Dashboard) => void; onError: (message: string) => void; onEvidence: (ids: string[], title: string) => void; onDraft: (draft: Draft) => void };

export function GrantsWorkspace({ dashboard, mode, onUpdate, onError, onEvidence, onDraft }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  async function generate(grantId: string) {
    setBusy(grantId); onError("");
    try {
      const result = await apiRequest<{ draft: Draft; dashboard: Dashboard }>("/api/drafts", "POST", { kind: "application", grantId, mode });
      onUpdate(result.dashboard); onDraft(result.draft);
    } catch (err) { onError(errorMessage(err)); } finally { setBusy(null); }
  }
  return <div className="workspace-content">
    <div className="grant-intro"><span className="section-icon teal"><CircleDollarSign size={20} /></span><p>Each funder’s calendar, categories, and application rules stay attached to its grant. Every spending figure links back to the ledger.</p></div>
    {dashboard.state.grants.map((grant) => {
      const ledger = dashboard.ledgers.find((item) => item.grantId === grant.id);
      if (!ledger) return null;
      const totalBudget = ledger.categories.reduce((sum, category) => sum + category.budgetCents, 0);
      const totalSpent = ledger.categories.reduce((sum, category) => sum + category.spentCents, 0);
      return <section className="panel grant-card" key={grant.id} aria-labelledby={`grant-${grant.id}`}>
        <div className="panel-heading"><div className="section-title"><span className="section-icon teal"><CircleDollarSign size={21} /></span><div><span className="eyebrow">FUNDER WORKSPACE</span><h2 id={`grant-${grant.id}`}>{grant.name}</h2></div></div><button className="text-button" onClick={() => onEvidence(grant.sourceIds, `${grant.name} · rules`)}><Link2 size={14} />Funder rules</button></div>
        <div className="grant-calendar"><span><CalendarDays size={15} />Funder year: <strong>{ledger.fiscalStart} — {ledger.fiscalEnd}</strong></span><span>{formatMetric(totalSpent / 100, "USD")} spent of {formatMetric(totalBudget / 100, "USD")} category budgets</span></div>
        <div className="category-grid">{ledger.categories.map((category) => <article className="category-card" key={category.name}><div><h3>{category.name}</h3><span className={`pill ${category.status === "over_budget" ? "pill-coral" : category.status === "near_limit" ? "pill-amber" : "pill-green"}`}>{category.status.replaceAll("_", " ")}</span></div><strong>{formatMetric(category.spentCents / 100, "USD")}<span> / {formatMetric(category.budgetCents / 100, "USD")}</span></strong><div className="budget-bar" role="img" aria-label={`${category.name}: ${formatMetric(category.spentCents / 100, "USD")} spent of ${formatMetric(category.budgetCents / 100, "USD")} budget`}><span className={category.status === "over_budget" ? "over" : category.status === "near_limit" ? "near" : ""} style={{ width: `${Math.min(100, category.budgetCents ? category.spentCents / category.budgetCents * 100 : 100)}%` }} /></div><div className="category-footer"><span>{category.remainingCents >= 0 ? `${formatMetric(category.remainingCents / 100, "USD")} remaining` : `${formatMetric(-category.remainingCents / 100, "USD")} over budget`}</span><button className="text-button" onClick={() => onEvidence(category.sourceIds, `${grant.name} · ${category.name}`)}>Evidence<ArrowRight size={12} /></button></div></article>)}</div>
        <div className="grant-exceptions"><ExpenseList title="Outside approved categories" description="These expenses need review before they can count toward this grant." expenses={ledger.disallowed} onEvidence={onEvidence} /><ExpenseList title="Outside this funder’s year" description="These expenses are excluded from the current funder-year totals." expenses={ledger.outsidePeriod} onEvidence={onEvidence} /></div>
        <div className="application-brief"><div><span className="eyebrow">APPLICATION QUESTION · {grant.wordLimit} WORDS MAXIMUM</span><h3>{grant.applicationQuestion}</h3><p>The draft uses source-backed record metrics. Review its facts and wording before approval.</p></div><button className="button button-primary" disabled={busy !== null} onClick={() => generate(grant.id)}>{busy === grant.id ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}Draft application</button></div>
      </section>;
    })}
  </div>;
}

function ExpenseList({ title, description, expenses, onEvidence }: { title: string; description: string; expenses: Expense[]; onEvidence: Props["onEvidence"] }) {
  return <div className="expense-exception"><div><AlertCircle size={15} /><h3>{title}</h3><span className="pill pill-neutral">{expenses.length}</span></div><p>{description}</p>{expenses.length ? <ul>{expenses.map((expense) => <li key={expense.id}><button onClick={() => onEvidence(expense.sourceIds, expense.description)}><span><strong>{expense.description}</strong><small>{expense.date} · {expense.category}</small></span><span>{formatMetric(expense.amountCents / 100, "USD")}</span><Link2 size={13} /></button></li>)}</ul> : <small className="muted">No exceptions in this snapshot.</small>}</div>;
}
