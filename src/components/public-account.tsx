"use client";
import { useEffect, useState } from "react";
type Account = { identity: { email: string }; retentionDays: number; workspace: string; sharing: string };
export function PublicAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const reason = new URLSearchParams(location.search).get("error");
    if (reason === "setup") setMessage("Google sign-in is awaiting publisher configuration. Please check back soon.");
    if (reason === "signin") setMessage("Sign-in did not finish. Please choose your Google account and try again.");
    fetch("/api/public/account", { signal: controller.signal }).then(async response => {
      if (response.ok) setAccount(await response.json());
      else if (response.status !== 401) setMessage("Account services are temporarily unavailable. Please retry shortly.");
    }).catch(error => { if (error.name !== "AbortError") setMessage("Could not connect. Check your connection and reload this page."); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  async function change(action: "logout" | "delete") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(action === "delete" ? "/api/public/account" : "/api/auth/logout", { method: action === "delete" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setAccount(null); setConfirmation("");
      setMessage(action === "delete" ? "Your Tidepath data has been deleted. Your Google Sheets and previously exported reports remain in your Drive." : "You’re signed out.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not complete this action."); }
    finally { setBusy(false); }
  }
  return <><p>Choose the same Google account you use for your donation spreadsheet. Your Tidepath workspace is private to that account, even when other people share the workbook.</p>{message && <p className="tp-notice" role="status">{message}</p>}{loading ? <p aria-live="polite">Checking your sign-in…</p> : !account ? <div className="tp-account"><h2>Welcome to Tidepath</h2><p>Sign in to manage your data and account. The add-on uses Google’s own consent flow inside Sheets.</p><div className="tp-actions"><a className="tp-button" href="/api/auth/google/start">Choose a Google account</a><a href="/install">Installation status</a></div></div> : <><div className="tp-account"><h2>{account.workspace}</h2><p><strong>{account.identity.email}</strong></p><p>{account.sharing}. Saved workspace data expires after {account.retentionDays} days without activity.</p><div className="tp-actions"><button className="tp-button secondary" disabled={busy} onClick={() => change("logout")}>Sign out</button><a href="/api/auth/google/start">Use a different Google account</a></div></div><div className="tp-account tp-danger"><h2>Delete your Tidepath data</h2><p>Removes imported donation records, saved reports, approvals, and account sessions from Tidepath. It does not delete source cells or report tabs in Google Sheets. To prevent quota resets, hashed usage counters survive deletion, expire 30 days after creation, and are removed by the next successful cleanup.</p><label>Type DELETE to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></label><button className="tp-button" disabled={confirmation !== "DELETE" || busy} onClick={() => change("delete")}>{busy ? "Working…" : "Delete my Tidepath data"}</button></div></>}<p><a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Manage or revoke Tidepath’s access in your Google account</a>. Uninstalling the add-on does not itself delete data already imported into Tidepath; use the deletion control above.</p></>;
}
