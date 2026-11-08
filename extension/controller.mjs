export const FIELDS = ["gift_id", "donor_id", "name", "email", "phone", "amount", "date", "channel", "currency", "quantity"];

export function toggleFindingSelection(selected, findings, findingId, checked) {
  const finding = findings.find(item => item.id === findingId);
  if (!finding?.proposedFix) throw new Error("Only proposed corrections can be selected.");
  const groupId = finding.proposedFix.groupId;
  for (const item of findings) {
    if (item.id !== findingId && (!groupId || item.proposedFix?.groupId !== groupId)) continue;
    if (checked) selected.add(item.id); else selected.delete(item.id);
  }
}

export function createController(send, uuid = () => crypto.randomUUID()) {
  const state = { status: null, session: null, workbooks: [], selected: new Set(), report: null, plan: null, pendingApply: null, pendingJobs: [], aiPreview: null, aiResult: null, operations: [], scans: [] };
  const request = (method, path, body) => send({ type: "request", method, path, body });
  const safeId = id => encodeURIComponent(String(id));
  async function savePending(value) {
    await send({ type: "pendingApply", value });
    state.pendingApply = value;
  }
  async function refresh() {
    state.session = await send({ type: "session" });
    state.pendingApply = state.session.pendingApply;
    state.pendingJobs = state.session.pendingJobs ?? [];
    state.status = state.session.paired ? await request("GET", "/v1/status") : null;
    return state.status;
  }
  async function history() {
    const data = await request("GET", "/v1/history");
    state.operations = data.operations ?? [];
    state.scans = data.scans ?? [];
    return data;
  }
  return {
    state, refresh, history,
    async pair(token) { state.status = await send({ type: "pair", token }); await refresh(); return state.status; },
    async unpair() { await send({ type: "unpair" }); Object.assign(state, { status: null, workbooks: [], report: null, plan: null, aiPreview: null, aiResult: null, operations: [], scans: [], pendingApply: null }); state.selected.clear(); await refresh(); },
    async connectGoogle() { await send({ type: "connectGoogle" }); return refresh(); },
    async disconnectGoogle() { await send({ type: "disconnectGoogle" }); state.workbooks = []; state.selected.clear(); state.report = null; state.plan = null; state.aiPreview = null; state.aiResult = null; state.operations = []; state.scans = []; return refresh(); },
    async discover() {
      const seenTokens = new Set();
      const all = new Map();
      let pageToken;
      do {
        const page = await request("GET", `/v1/workbooks${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`);
        for (const file of page.files ?? []) all.set(file.id, file);
        pageToken = page.nextPageToken;
        if (pageToken && seenTokens.has(pageToken)) throw new Error("Discovery returned a repeated page. No workbook has been scanned.");
        if (pageToken) seenTokens.add(pageToken);
        if (seenTokens.size > 50 || all.size > 10000) throw new Error("Discovery exceeded its local limit. Narrow the available Google account scope.");
      } while (pageToken);
      state.workbooks = [...all.values()];
      for (const id of state.selected) if (!all.has(id)) state.selected.delete(id);
      return state.workbooks;
    },
    async scan({ broadScan = false, confirmNonSensitive = false, tabs } = {}) {
      const workbookIds = [...state.selected];
      if (!workbookIds.length) throw new Error("Select at least one workbook.");
      if (workbookIds.length > 1 && !broadScan) throw new Error("Explicitly enable scanning across multiple workbooks.");
      if (!confirmNonSensitive) throw new Error("Confirm that the selected sheets are appropriate for a general data scan.");
      if (workbookIds.length > (state.status?.limits?.maxWorkbooks ?? 20)) throw new Error("Select no more than 20 workbooks per scan.");
      const data = await request("POST", "/v1/scans", { workbookIds, broadScan, confirmNonSensitive, options: tabs ? { tabs } : {} });
      state.report = data; state.plan = null; state.aiPreview = null; state.aiResult = null;
      return data;
    },
    async loadScan(id) {
      state.report = await request("GET", `/v1/scans/${safeId(id)}`);
      state.selected = new Set(state.report.scope.workbookIds);
      state.plan = null; state.aiPreview = null; state.aiResult = null;
      return state.report;
    },
    async plan(findingIds) {
      if (!state.report) throw new Error("Scan selected workbooks first.");
      if (!findingIds.length) throw new Error("Choose at least one proposed correction to review.");
      const allowed = new Set(state.report.findings.filter(item => item.proposedFix).map(item => item.id));
      if (findingIds.some(id => !allowed.has(id))) throw new Error("Manual findings cannot be applied automatically.");
      const selected = state.report.findings.filter(item => findingIds.includes(item.id));
      for (const finding of selected) {
        const ref = finding.proposedFix.ref;
        if (state.report.mappings && !state.report.mappings.some(item => item.workbookId === ref.workbookId && item.sheetId === ref.sheetId && item.confirmed)) throw new Error("Open the column mappings, review each edited tab, then choose Confirm mappings and rescan before building a plan.");
        if (finding.proposedFix.groupId && state.report.findings.some(item => item.proposedFix?.groupId === finding.proposedFix.groupId && !findingIds.includes(item.id))) throw new Error("An identity decision must include every matching donor row in its group.");
      }
      const plan = await request("POST", `/v1/scans/${safeId(state.report.id)}/plan`, { findingIds });
      if (state.pendingApply?.planId !== plan.id) await savePending(null);
      state.plan = plan;
      return plan;
    },
    async apply(approved) {
      if (approved !== true) throw new Error("Review the exact corrections and approve creation of new copies.");
      if (!state.plan) throw new Error("Create a correction plan first.");
      if (state.pendingApply?.planId !== state.plan.id) await savePending({ planId: state.plan.id, requestId: uuid() });
      return request("POST", `/v1/plans/${safeId(state.pendingApply.planId)}/apply`, { approved: true, requestId: state.pendingApply.requestId });
    },
    async retryPending() {
      if (!state.pendingApply) throw new Error("No saved copy request is waiting.");
      return request("POST", `/v1/plans/${safeId(state.pendingApply.planId)}/apply`, { approved: true, requestId: state.pendingApply.requestId });
    },
    async retryOperation(id) { return request("POST", `/v1/operations/${safeId(id)}/retry`, { approved: true }); },
    async resumeJob(jobId) {
      const recovered = await send({ type: "resumeJob", jobId });
      if (recovered.path === "/v1/scans") { state.report = recovered.result; state.selected = new Set(state.report.scope.workbookIds); state.plan = null; state.aiPreview = null; state.aiResult = null; }
      if (recovered.path.startsWith("/v1/workbooks")) state.workbooks = recovered.result.files ?? [];
      if (/\/plan$/.test(recovered.path)) state.plan = recovered.result;
      if (/\/ai$/.test(recovered.path)) state.aiResult = recovered.result;
      await refresh();
      return recovered;
    },
    async previewAi() {
      if (!state.report) throw new Error("Scan selected workbooks first.");
      state.aiPreview = await request("GET", `/v1/scans/${safeId(state.report.id)}/ai-preview`);
      state.aiResult = null;
      return state.aiPreview;
    },
    async requestAi(approved) {
      if (approved !== true || !state.aiPreview) throw new Error("Preview and explicitly approve the outgoing AI payload first.");
      if (!state.status?.ai?.keyPresent) throw new Error("Enter your API key in the local companion terminal first.");
      state.aiResult = await request("POST", `/v1/scans/${safeId(state.report.id)}/ai`, { enabled: true, approvedPayloadHash: state.aiPreview.payloadHash });
      await refresh();
      return state.aiResult;
    },
    async clearAiKey() { await request("DELETE", "/v1/ai/key"); state.aiPreview = null; state.aiResult = null; return refresh(); },
  };
}
