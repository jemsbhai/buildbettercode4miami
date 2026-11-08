export const COMPANION_ORIGIN = "http://127.0.0.1:4318";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

const ROUTES = [
  ["GET", /^\/v1\/(status|history)$/],
  ["GET", /^\/v1\/workbooks(?:\?pageToken=[A-Za-z0-9%_.~!-]*)?$/],
  ["GET", /^\/v1\/scans\/[A-Za-z0-9_-]+(?:\/ai-preview)?$/],
  ["GET", /^\/v1\/jobs\/[A-Za-z0-9_-]+$/],
  ["POST", /^\/v1\/scans$/],
  ["POST", /^\/v1\/scans\/[A-Za-z0-9_-]+\/(plan|ai)$/],
  ["POST", /^\/v1\/plans\/[A-Za-z0-9_-]+\/apply$/],
  ["POST", /^\/v1\/operations\/[A-Za-z0-9_-]+\/retry$/],
  ["DELETE", /^\/v1\/ai\/key$/],
];

export function isAllowedRequest(method, path) {
  return typeof path === "string" && ROUTES.some(([verb, pattern]) => verb === method && pattern.test(path));
}

export function createBridge({ chromeApi, fetchImpl = fetch, timeoutMs = 25000, pollIntervalMs = 1000, maxPolls = 240, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const session = chromeApi.storage.session;
  let accessReady;
  let storageQueue = Promise.resolve();
  const ready = () => accessReady ??= session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const trustedSender = sender => sender?.id === chromeApi.runtime.id && sender.url === chromeApi.runtime.getURL("app.html");
  async function updateJobs(change) {
    const action = storageQueue.then(async () => {
      const current = (await session.get("pendingJobs")).pendingJobs ?? [];
      await session.set({ pendingJobs: change(current) });
    });
    storageQueue = action.catch(() => {});
    return action;
  }
  async function fetchJson(method, path, body, suppliedToken) {
    await ready();
    const token = suppliedToken ?? (await session.get("pairingToken")).pairingToken;
    if (!token) throw new Error("Pair with your local companion first.");
    let response;
    try {
      response = await fetchImpl(`${COMPANION_ORIGIN}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tidepath-Extension-Id": chromeApi.runtime.id, Prefer: "respond-async" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new Error("The local companion did not respond. Check that it is running. If creating copies, keep the same request and check history before retrying.");
    }
    let data;
    try { data = await response.json(); } catch { throw new Error("The local companion returned an unreadable response. Check operation history before retrying a copy."); }
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Local request failed (${response.status}).`);
    return { data, status: response.status };
  }
  async function pollJob(job, suppliedToken) {
    for (let count = 0; count < maxPolls; count++) {
      await wait(pollIntervalMs);
      const { data } = await fetchJson("GET", `/v1/jobs/${job.jobId}`, undefined, suppliedToken);
      if (data.status === "completed") {
        await updateJobs(current => current.filter(item => item.jobId !== job.jobId));
        return data.result;
      }
      if (data.status === "failed") {
        await updateJobs(current => current.filter(item => item.jobId !== job.jobId));
        throw new Error(typeof data.error === "string" ? data.error : "The background operation failed. Check history before repeating a correction request.");
      }
      if (data.status !== "running") throw new Error("The local companion returned an invalid background job status. Check recovery before repeating the operation.");
    }
    throw new Error("This background operation is still pending. Use Recover background request in History; its original request will not be repeated.");
  }
  async function localRequest(method, path, body, suppliedToken) {
    const { data, status } = await fetchJson(method, path, body, suppliedToken);
    if (status !== 202) return data;
    if (typeof data.jobId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(data.jobId)) throw new Error("The companion did not supply a valid recovery job ID. Check operation history before repeating a correction.");
    const job = { jobId: data.jobId, method, path };
    await updateJobs(current => [...current.filter(item => item.jobId !== job.jobId), job]);
    return pollJob(job, suppliedToken);
  }
  async function handle(message, sender) {
    if (!trustedSender(sender)) throw new Error("This action is available only from Tidepath's extension page.");
    await ready();
    if (!message || typeof message !== "object") throw new Error("Invalid extension request.");
    switch (message.type) {
      case "session": {
        const data = await session.get(["pairingToken", "pendingApply", "pendingJobs"]);
        return { paired: Boolean(data.pairingToken), extensionId: chromeApi.runtime.id, oauthConfigured: Boolean(chromeApi.runtime.getManifest().oauth2?.client_id), pendingApply: data.pendingApply ?? null, pendingJobs: data.pendingJobs ?? [] };
      }
      case "pair": {
        if (typeof message.token !== "string" || !/^[A-Za-z0-9_-]{32,200}$/.test(message.token)) throw new Error("Enter the connection token printed by your local companion.");
        const status = await localRequest("GET", "/v1/status", undefined, message.token);
        if (status.service !== "tidepath-local") throw new Error("The process on port 4318 is not Tidepath Local.");
        await session.set({ pairingToken: message.token });
        return status;
      }
      case "unpair": {
        try { await localRequest("DELETE", "/v1/google"); } catch { /* Local memory is still cleared below. */ }
        try { await chromeApi.identity.clearAllCachedAuthTokens(); } finally { await session.clear(); }
        return { paired: false };
      }
      case "connectGoogle": {
        if (!(await session.get("pairingToken")).pairingToken) throw new Error("Pair with your local companion first.");
        if (!chromeApi.runtime.getManifest().oauth2?.client_id) throw new Error("Google OAuth is not configured in this package. Use the local fixture rehearsal, or build with your own Chrome OAuth client ID; see the loading guide.");
        const auth = await chromeApi.identity.getAuthToken({ interactive: true, enableGranularPermissions: true, scopes: GOOGLE_SCOPES });
        if (!auth?.token) throw new Error("Google did not return authorization.");
        if (auth.grantedScopes && GOOGLE_SCOPES.some(scope => !auth.grantedScopes.includes(scope))) {
          await chromeApi.identity.removeCachedAuthToken({ token: auth.token });
          throw new Error("Google access was incomplete. All three listed scopes are required for discovery, reading and correction copies.");
        }
        await localRequest("POST", "/v1/google", { accessToken: auth.token });
        return { connected: true };
      }
      case "disconnectGoogle": {
        let problem;
        try { await localRequest("DELETE", "/v1/google"); } catch (error) { problem = error; }
        await chromeApi.identity.clearAllCachedAuthTokens();
        if (problem) throw problem;
        return { connected: false };
      }
      case "pendingApply": {
        const pending = message.value;
        if (pending !== null && (!pending || !/^[A-Za-z0-9_-]+$/.test(pending.planId) || !/^[A-Za-z0-9_-]+$/.test(pending.requestId))) throw new Error("Invalid saved copy request.");
        if (pending === null) await session.remove("pendingApply");
        else await session.set({ pendingApply: { planId: pending.planId, requestId: pending.requestId } });
        return { saved: true };
      }
      case "resumeJob": {
        const jobs = (await session.get("pendingJobs")).pendingJobs ?? [];
        const job = jobs.find(item => item.jobId === message.jobId);
        if (!job) throw new Error("No matching background request is saved in this session. Check companion history.");
        return { ...job, result: await pollJob(job) };
      }
      case "request": {
        const method = message.method ?? "GET";
        if (!isAllowedRequest(method, message.path)) throw new Error("Unsupported local operation.");
        if (JSON.stringify(message.body ?? {}).length > 200000) throw new Error("Request is too large.");
        return localRequest(method, message.path, message.body);
      }
      default: throw new Error("Unknown extension action.");
    }
  }
  return { handle, ready };
}
