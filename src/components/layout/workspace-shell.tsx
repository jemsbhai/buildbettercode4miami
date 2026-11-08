"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CircleDollarSign, ClipboardCheck, HeartHandshake, LayoutDashboard, LoaderCircle, LockKeyhole, ShieldCheck, Waves } from "lucide-react";
import styles from "./workspace-shell.module.css";

const routes = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: HeartHandshake },
  { href: "/grants", label: "Grants & reports", icon: CircleDollarSign },
  { href: "/counseling", label: "Counseling", icon: LockKeyhole },
];

export type WorkspaceShellProps = {
  title: string;
  description: string;
  period?: string;
  asOf?: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
  children?: ReactNode;
};

export default function WorkspaceShell({ title, description, period, asOf, loading, error, onRetry, children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const active = routes.find((route) => route.href === pathname);
  return <div className="app-shell">
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <aside className={`sidebar ${styles.sidebar}`}>
      <Link className="brand" href="/" aria-label="Tidepath home"><span className="brand-mark"><Waves size={28} strokeWidth={1.8} /></span><span>Tidepath<span className="brand-sub">FAMILY ALLIANCE</span></span></Link>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Workspace">{routes.map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch={false} className={`nav-item ${pathname === href ? "active" : ""} ${styles.navLink}`} aria-label={label} aria-current={pathname === href ? "page" : undefined}><Icon size={19} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-note"><ShieldCheck size={22} /><strong>Good work deserves<br />a clear record.</strong><p>Every number has a source.<br />Every action has a reviewer.</p></div>
      <div className="sidebar-footer"><span className="avatar">TF</span><div><strong>Tidepath demo team</strong><small>Miami-Dade, Florida</small></div><ArrowUpRight size={15} /></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span className="topbar-crumb">Workspace <span>/</span>{active?.label}</span><span className="demo-badge"><span />SYNTHETIC DEMO</span></header>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><span className="eyebrow">LESS ADMIN. MORE HUMAN.</span><h1>{title}</h1><p>{description}</p></div></div>
        <div className="context-bar"><div><ClipboardCheck size={16} /><strong>{period ?? (loading ? "Loading quarter" : "Quarter unavailable")}</strong><span className="context-detail">{asOf ? `Record as of ${asOf.slice(0, 10)}` : "One shared record"}</span></div><span>Fictional demo data</span></div>
        {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" size={26} /><h2>Bringing your records together</h2><p>Loading the synthetic quarter.</p></div> : error ? <div className="notice notice-error" role="alert"><div><h2>The workspace could not load.</h2><p>{error}</p><button className="button button-primary" onClick={onRetry}>Try again</button></div></div> : children}
        <footer className="main-footer"><span>Built for the people who show up for their community.</span><span>Fictional people and gifts · No external messages sent</span></footer>
      </main>
    </div>
  </div>;
}
