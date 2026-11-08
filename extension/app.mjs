import { createController, FIELDS, toggleFindingSelection } from "./controller.mjs";

const $ = id => document.getElementById(id);
const send = async message => {
  const reply = await chrome.runtime.sendMessage(message);
  if (!reply?.ok) throw new Error(reply?.error ?? "The extension service worker did not respond.");
  return reply.data;
};
const controller = createController(send);
const { state } = controller;
let busy = false;
const selectedFixes = new Set();
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
};
function announce(message, error = false) { $("notice").textContent = message; $("notice").className = error ? "error" : ""; }
async function run(label, action, success) {
  if (busy) return;
  busy = true; announce(label); $("notice").className = "busy"; renderControls();
  try { await action(); announce(success ?? "Ready."); }
  catch (error) { announce(error instanceof Error ? error.message : "The operation could not finish.", true); }
  finally {
    try { const session = await send({ type: "session" }); state.pendingJobs = session.pendingJobs ?? []; state.pendingApply = session.pendingApply; } catch { /* Keep existing recovery state if the worker is unavailable. */ }
    busy = false; renderPendingJobs(); renderControls();
  }
}
const bind = (id, label, action, success) => $(id).addEventListener("click", () => run(label, action, success));
function renderControls() {
  const paired = Boolean(state.status);
  const google = paired && state.status.googleConnected;
  $("connection-badge").textContent = paired ? state.status.demo ? "Fictional fixture mode" : "Connected locally" : "Not connected";
  $("status-text").textContent = paired ? `${state.status.demo ? "Fictional fixtures only. No Google or provider calls are made in rehearsal mode. " : "Google data flows directly through your local companion. "}Local processing has no owner-funded service dependency.` : "Listening for your user-run companion at 127.0.0.1:4318.";
  $("ai-badge").textContent = state.status?.ai?.keyPresent ? `Key in local memory · ${state.status.ai.attempts}/${state.status.ai.maxAttempts} attempts` : "AI off · no key";
  $("extension-id").textContent = state.session?.extensionId ?? chrome.runtime.id;
  $("start-command").textContent = `npm run sheets:local -- --extension-id=${state.session?.extensionId ?? chrome.runtime.id}`;
  $("oauth-note").textContent = state.status?.demo ? "Google authorization is bypassed only in this clearly labeled fictional fixture mode." : state.session?.oauthConfigured ? "Google consent grants spreadsheet metadata discovery, read-only source access and access to files created by this app. It does not silently select or scan any workbook." : "Google OAuth is not configured. Build with your own Chrome OAuth client ID for real sheets, or run the companion with --demo for a complete fictional rehearsal.";
  for (const button of document.querySelectorAll("button")) button.disabled = busy;
  const disabled = (id, value) => $(id).disabled = busy || value;
  disabled("unpair", !paired); disabled("google-connect", !paired || state.status.demo || !state.session?.oauthConfigured);
  disabled("google-disconnect", !google || state.status.demo); disabled("discover", !google);
  disabled("select-all", !state.workbooks.length); disabled("select-none", !state.workbooks.length);
  disabled("scan", !google || !state.selected.size); disabled("rescan", !google);
  disabled("build-plan", !selectedFixes.size); disabled("preview-ai", !state.report);
  disabled("clear-ai", !state.status?.ai?.keyPresent); disabled("run-ai", !state.aiPreview || !state.status?.ai?.keyPresent || !$("approve-ai").checked);
  disabled("apply", !state.plan || !$("approve-copy").checked); disabled("history-refresh", !google);
  disabled("retry-pending", !google); $("retry-pending").hidden = !state.pendingApply;
  $("selected-count").textContent = `${state.selected.size} selected · up to ${state.status?.limits?.maxWorkbooks ?? 20} per scan`;
  $("report-section").hidden = !state.report; $("plan-section").hidden = !state.plan;
}
function renderWorkbooks() {
  const target = $("workbooks"); target.replaceChildren();
  if (!state.workbooks.length) target.append(node("p", "No accessible spreadsheets were found.", "muted"));
  for (const file of state.workbooks) {
    const label = node("label", undefined, "workbook");
    const checkbox = node("input"); checkbox.type = "checkbox"; checkbox.checked = state.selected.has(file.id);
    checkbox.addEventListener("change", () => { if (checkbox.checked) state.selected.add(file.id); else state.selected.delete(file.id); renderControls(); });
    const text = node("span", file.name); text.append(node("small", file.id)); label.append(checkbox, text); target.append(label);
  }
}
function metric(value, title) { const item = node("div", undefined, "metric"); item.append(node("strong", value), node("span", title)); return item; }
function formatCents(value) {
  if (!/^-?\d+$/.test(String(value))) return String(value);
  const cents = BigInt(value); const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
function cellText(cell) { return cell?.formula ? `Formula: ${cell.formula}` : cell?.value === null || cell?.value === undefined ? "(empty)" : String(cell.value); }
function refText(ref) { return `${ref.workbookId} · ${ref.sheetTitle} · ${ref.a1}`; }
function changeView(patch) {
  const item = node("div", undefined, "change");
  item.append(node("del", cellText(patch.before)), node("span", "→"), node("ins", cellText(patch.after)));
  return item;
}
function renderReport() {
  selectedFixes.clear(); $("safe-all").checked = false; $("approve-copy").checked = false; $("approve-ai").checked = false; $("ai-review").hidden = true; $("ai-result").replaceChildren(); $("operation-result").replaceChildren();
  const report = state.report;
  $("mapping-details").open = report.mappings.some(mapping => !mapping.confirmed);
  $("metrics").replaceChildren(metric(report.scope.workbookIds.length, "selected workbooks"), metric(report.scope.tabCount, "eligible tabs"), metric(report.totals.giftCount, "gift rows preserved"), metric(report.findings.length, "findings to review"));
  for (const [currency, cents] of Object.entries(report.totals.amountCentsByCurrency)) $("metrics").append(metric(`${currency} ${formatCents(cents)}`, "valid exact amount subtotal"));
  const summary = $("scope-summary"); summary.replaceChildren();
  summary.append(node("p", `${report.totals.invalidAmountCount} invalid amounts are excluded from valid subtotals. This is a bounded data review, not a guarantee that every possible spreadsheet issue has been detected.`, "small"));
  if (report.excluded.length) {
    const detail = node("details"); detail.append(node("summary", `${report.excluded.length} private or unsupported scope exclusions`));
    for (const item of report.excluded) detail.append(node("p", `${item.workbookId} · tab ${item.sheetId}${item.columns ? ` · columns ${item.columns.map(value => value + 1).join(", ")}` : ""}: ${item.reason}`, "small"));
    summary.append(detail);
  }
  if (report.limits.length) { const list = node("ul"); for (const limit of report.limits) list.append(node("li", limit)); const detail = node("details"); detail.append(node("summary", "Supported scope and limits"), list); summary.append(detail); }
  renderMappings(); renderFindings(); renderControls();
}
function renderFindings() {
  const target = $("findings"); target.replaceChildren();
  if (!state.report.findings.length) target.append(node("p", "No supported issue was found in the selected scope. Review the scope and mappings above."));
  for (const finding of state.report.findings) {
    const item = node("article", undefined, `finding ${finding.severity}`);
    const row = node("label", undefined, "check");
    if (finding.proposedFix) {
      const checkbox = node("input"); checkbox.type = "checkbox"; checkbox.checked = selectedFixes.has(finding.id);
      checkbox.setAttribute("aria-label", `Review correction: ${finding.message}`);
      checkbox.addEventListener("change", () => { toggleFindingSelection(selectedFixes, state.report.findings, finding.id, checkbox.checked); $("safe-all").checked = state.report.findings.filter(value => value.proposedFix).every(value => selectedFixes.has(value.id)); if (finding.proposedFix.groupId) renderFindings(); renderControls(); });
      row.append(checkbox);
    }
    const body = node("div", undefined, "finding-body"); body.append(node("span", `${finding.severity} · ${finding.type.replaceAll("_", " ")} · ${finding.proposedFix ? "proposed correction" : "manual review"}`, "tag"), node("p", finding.message));
    for (const ref of finding.refs) body.append(node("div", refText(ref), "refs"));
    if (finding.proposedFix) body.append(changeView(finding.proposedFix), node("p", finding.proposedFix.reason, "small"));
    row.append(body); item.append(row); target.append(item);
  }
}
function selectControl(labelText, entries, value, name) {
  const label = node("label", labelText); const select = node("select"); select.name = name;
  for (const [id, text] of entries) { const option = node("option", text); option.value = String(id); select.append(option); }
  select.value = String(value); label.append(select); return label;
}
function renderMappings() {
  const target = $("mappings"); target.replaceChildren();
  for (const mapping of state.report.mappings) {
    const group = node("div", undefined, "mapping"); group.dataset.workbookId = mapping.workbookId; group.dataset.sheetId = String(mapping.sheetId);
    group.append(node("h3", `${mapping.sheetTitle} · ${mapping.kind} · ${mapping.confirmed ? "reviewed" : "inferred"}`), node("p", mapping.workbookId, "small"));
    const fields = node("div", undefined, "mapping-grid");
    const entries = [["", "Not mapped"], ...mapping.headers.map((header, index) => [String(index), `${index + 1}: ${header || "(blank header)"}`])];
    for (const field of FIELDS) {
      const wrapper = node("div"); wrapper.append(selectControl(field.replaceAll("_", " "), entries, mapping.mapping[field] ?? "", field));
      const requiredLabel = node("label", undefined, "check small"); const required = node("input"); required.type = "checkbox"; required.name = `required-${field}`; required.checked = mapping.requiredFields.includes(field);
      requiredLabel.append(required, document.createTextNode("Required field")); wrapper.append(requiredLabel); fields.append(wrapper);
    }
    fields.append(selectControl("Amount unit", [["dollars", "Major units (e.g. dollars)"], ["cents", "Minor units (cents)"]], mapping.amountUnit, "amountUnit"));
    fields.append(selectControl("Date order", [["", "Do not guess ambiguous dates"], ["MDY", "Month / day / year"], ["DMY", "Day / month / year"]], mapping.dateOrder ?? "", "dateOrder"));
    const currencyLabel = node("label", "Default currency code"); const currency = node("input"); currency.name = "defaultCurrency"; currency.value = mapping.currency; currency.maxLength = 3; currencyLabel.append(currency); fields.append(currencyLabel);
    group.append(fields); target.append(group);
  }
}
function mappingOptions() {
  return [...document.querySelectorAll(".mapping")].map(group => {
    const value = name => group.querySelector(`[name="${name}"]`).value;
    const mapping = Object.fromEntries(FIELDS.map(field => [field, value(field) === "" ? null : Number(value(field))]));
    const requiredFields = FIELDS.filter(field => group.querySelector(`[name="required-${field}"]`).checked);
    return { workbookId: group.dataset.workbookId, sheetId: Number(group.dataset.sheetId), mapping, requiredFields, amountUnit: value("amountUnit"), currency: value("defaultCurrency").trim().toUpperCase(), ...(value("dateOrder") ? { dateOrder: value("dateOrder") } : {}) };
  });
}
function renderPlan() {
  $("approve-copy").checked = false; const target = $("plan"); target.replaceChildren();
  target.append(node("p", `${state.plan.patches.length} corrections in ${state.plan.workbookIds.length} new workbook copies. Exact gift count: ${state.plan.totals.giftCount}.`, "small"));
  for (const patch of state.plan.patches) { const item = node("div", undefined, "finding"); item.append(node("p", refText(patch.ref), "refs"), changeView(patch), node("p", patch.reason, "small")); target.append(item); }
  $("plan-section").hidden = false; renderControls(); $("plan-title").scrollIntoView({ block: "start" });
}
function operationView(operation) {
  const item = node("div", undefined, "history-item");
  item.append(node("h3", `Copy operation · ${operation.status ?? "recorded"}`), node("p", `Request: ${operation.operationId ?? operation.id ?? operation.requestId ?? "recorded"}`, "small"));
  if (operation.error) item.append(node("p", operation.error));
  if (operation.message) item.append(node("p", operation.message));
  const copies = operation.entries ?? operation.copies ?? operation.workbooks ?? operation.outputs ?? [];
  for (const copy of copies) {
    const row = node("p", `${copy.sourceId ?? copy.workbookId ?? "Source workbook"} · ${copy.status ?? "recorded"} `);
    const id = copy.copyId ?? copy.id;
    if (id && /^[A-Za-z0-9_-]+$/.test(id) && !state.status?.demo) { const link = node("a", "Inspect correction copy"); link.href = `https://docs.google.com/spreadsheets/d/${id}/edit`; link.target = "_blank"; link.rel = "noopener noreferrer"; row.append(link); }
    else if (id) row.append(document.createTextNode(`Fixture copy: ${id}`));
    item.append(row);
    if (copy.error) item.append(node("p", copy.error, "small"));
    if (copy.message) item.append(node("p", copy.message, "small"));
  }
  const detail = node("details"); detail.append(node("summary", "Recorded operation details"), node("pre", JSON.stringify(operation, null, 2))); item.append(detail);
  if (!["complete", "completed", "verified"].includes(operation.status) && (operation.operationId ?? operation.id)) {
    const button = node("button", "Check / recover this approved operation", "secondary");
    button.addEventListener("click", () => run("Checking the existing operation without blindly creating another copy…", async () => { const result = await controller.retryOperation(operation.operationId ?? operation.id); $("operation-result").replaceChildren(operationView(result)); await controller.history(); renderHistory(); }, "Recovery status loaded. Inspect the recorded result."));
    item.append(button);
  }
  return item;
}
function renderHistory() {
  const target = $("history"); target.replaceChildren();
  for (const operation of state.operations) target.append(operationView(operation));
  for (const scan of state.scans) {
    const item = node("div", undefined, "history-item"); item.append(node("h3", `Scan · ${scan.scope?.workbookIds?.length ?? "selected"} workbooks`), node("p", scan.createdAt ? new Date(scan.createdAt).toLocaleString() : scan.id, "small"));
    const button = node("button", "Open recorded findings", "secondary");
    button.addEventListener("click", () => run("Loading recorded findings…", async () => { await controller.loadScan(scan.id); renderReport(); renderWorkbooks(); }, "Recorded findings loaded. Rescan before applying if the source has changed."));
    item.append(button); target.append(item);
  }
  if (!state.operations.length && !state.scans.length) target.append(node("p", "No scans or copy operations have been recorded in this companion session.", "muted"));
}
function clearRenderedReview() {
  for (const id of ["metrics", "scope-summary", "mappings", "findings", "plan", "operation-result", "ai-payload", "ai-result", "history"]) $(id).replaceChildren();
  $("ai-review").hidden = true; $("approve-ai").checked = false; $("approve-copy").checked = false;
  $("privacy-consent").checked = false; $("broad-scan").checked = false; selectedFixes.clear();
}
function renderPendingJobs() {
  const target = $("pending-jobs"); target.replaceChildren();
  for (const job of state.pendingJobs) {
    const item = node("div", undefined, "history-item"); item.append(node("p", `Background request pending: ${job.method} ${job.path}`, "small"));
    const button = node("button", "Recover background request", "secondary"); button.disabled = busy || !state.status;
    button.addEventListener("click", () => run("Recovering the existing background request…", async () => {
      const recovered = await controller.resumeJob(job.jobId);
      if (recovered.path === "/v1/scans") { renderReport(); renderWorkbooks(); }
      else if (recovered.path.startsWith("/v1/workbooks")) renderWorkbooks();
      else if (/\/plan$/.test(recovered.path)) renderPlan();
      else if (/\/(apply|retry)$/.test(recovered.path)) $("history").prepend(operationView(recovered.result));
      else { const details = node("details"); details.open = true; details.append(node("summary", "Recovered background result"), node("pre", JSON.stringify(recovered.result, null, 2))); $("history").prepend(details); }
    }, "Background result recovered. The original request was not repeated."));
    item.append(button); target.append(item);
  }
}
$("pair-form").addEventListener("submit", event => {
  event.preventDefault(); const token = $("pair-token").value.trim(); $("pair-token").value = "";
  run("Connecting to your local companion…", async () => { await controller.pair(token); $("setup").open = false; if (state.status.googleConnected) { await controller.history(); renderHistory(); } }, "Local connection ready. Connect Google, or use fixture discovery. No workbook is selected automatically.");
});
bind("refresh", "Checking connection…", async () => { await controller.refresh(); }, "Connection status refreshed.");
bind("unpair", "Clearing this connection…", async () => { await controller.unpair(); renderWorkbooks(); clearRenderedReview(); }, "Connection forgotten. Stop the local process to clear its remaining in-memory credentials.");
bind("google-connect", "Opening Google authorization…", async () => controller.connectGoogle(), "Google is connected. You can now discover spreadsheets and choose a scope.");
bind("google-disconnect", "Disconnecting Google…", async () => { await controller.disconnectGoogle(); renderWorkbooks(); clearRenderedReview(); renderHistory(); }, "Google access removed from this companion and Chrome token cache. To revoke the OAuth grant, use your Google account’s third-party access settings.");
bind("discover", "Finding accessible spreadsheet names…", async () => { await controller.discover(); renderWorkbooks(); }, "Discovery complete. Select only the workbooks you want to scan.");
$("select-all").addEventListener("click", () => { if (!$("broad-scan").checked) { announce("Enable scanning across multiple workbooks before selecting all listed spreadsheets.", true); return; } if (state.workbooks.length > (state.status?.limits?.maxWorkbooks ?? 20)) { announce("More than 20 workbooks are listed. Select a smaller scope manually.", true); return; } state.selected = new Set(state.workbooks.map(file => file.id)); renderWorkbooks(); renderControls(); });
$("select-none").addEventListener("click", () => { state.selected.clear(); renderWorkbooks(); renderControls(); });
const scan = async tabs => { await controller.scan({ broadScan: $("broad-scan").checked, confirmNonSensitive: $("privacy-consent").checked, tabs }); renderReport(); await controller.history(); renderHistory(); };
bind("scan", "Reading and checking only the selected workbooks…", () => scan(), "Scan complete. Review inferred mappings, findings and scope exclusions.");
bind("rescan", "Rescanning with your reviewed mappings…", () => scan(mappingOptions()), "Scan complete with the selected mapping rules.");
$("safe-all").addEventListener("change", () => { selectedFixes.clear(); if ($("safe-all").checked) for (const finding of state.report.findings) if (finding.proposedFix) selectedFixes.add(finding.id); renderFindings(); renderControls(); });
bind("build-plan", "Building the exact correction plan…", async () => { await controller.plan([...selectedFixes]); renderPlan(); }, "Review the changes, then approve creation of correction copies.");
$("approve-copy").addEventListener("change", renderControls); $("approve-ai").addEventListener("change", renderControls);
bind("apply", "Creating and verifying correction copies. Keep this page open…", async () => { const operation = await controller.apply($("approve-copy").checked); $("operation-result").replaceChildren(operationView(operation)); $("approve-copy").checked = false; await controller.history(); renderHistory(); }, "Copy operation returned. Read its verification status below; originals remain unchanged.");
bind("retry-pending", "Recovering the same approved request…", async () => { const operation = await controller.retryPending(); $("history").prepend(operationView(operation)); }, "Recovery returned. Check the recorded status before taking another action.");
bind("history-refresh", "Loading local history…", async () => { await controller.history(); renderHistory(); }, "History refreshed.");
bind("preview-ai", "Preparing the exact disclosure preview locally…", async () => { const preview = await controller.previewAi(); $("approve-ai").checked = false; $("ai-disclosure").textContent = preview.disclosure; $("ai-payload").textContent = JSON.stringify(preview.payload, null, 2); $("ai-review").hidden = false; $("ai-result").replaceChildren(); }, "Preview ready. Nothing has been sent to OpenAI.");
bind("run-ai", "Sending the single approved payload using your local key…", async () => { const approved = $("approve-ai").checked; $("approve-ai").checked = false; const result = await controller.requestAi(approved); const target = $("ai-result"); target.replaceChildren(node("h3", `AI advice · ${result.status}`)); if (result.text) target.append(node("pre", result.text)); if (result.error) target.append(node("p", result.error)); target.append(node("p", result.usage?.known ? `Provider-reported tokens: ${result.usage.inputTokens ?? 0} input / ${result.usage.outputTokens ?? 0} output. Account billing determines the charge.` : "Provider token usage is incomplete or unknown. An error does not guarantee there was no charge.", "small")); }, "AI request finished. Advice is untrusted; it cannot approve or apply any change.");
bind("clear-ai", "Removing the API key from local memory…", async () => { await controller.clearAiKey(); $("ai-review").hidden = true; $("ai-result").replaceChildren(); }, "API key removed from the companion. Deterministic tools remain available.");
$("download-report").addEventListener("click", () => { if (!state.report) return; const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = node("a"); link.href = url; link.download = `tidepath-findings-${state.report.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce("Findings download requested. This file contains local source references and reviewed values; store it appropriately."); });
run("Checking your local session…", async () => { await controller.refresh(); if (state.status?.googleConnected) { await controller.history(); renderHistory(); } }, "Ready. Select your scope explicitly before scanning.");
