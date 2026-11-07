import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { AppError } from "../service";
import { publicOrigin } from "./http";
import { verifyGoogleIdentity, type GoogleIdentity } from "./auth";
import { getPublicStore, type PostgresWorkspaceStore } from "./storage";

export const SESSION_COOKIE = "__Host-tidepath-session";
export const FLOW_COOKIE = "__Host-tidepath-oauth";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
export type WebAuthDependencies = { fetch?: typeof fetch; verify?: typeof verifyGoogleIdentity;
  store?: Pick<PostgresWorkspaceStore, "createSession" | "readSession" | "deleteSession"> };
function flowKey() {
  const secret = process.env.TIDEPATH_SESSION_SECRET;
  if (!secret || secret.length < 43) throw new AppError("Google sign-in is being configured. Please try again later.", 503);
  return createHash("sha256").update(secret).digest();
}
export function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="))?.slice(name.length + 1);
}
export function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export async function beginGoogleSignIn() {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_WEB_CLIENT_SECRET) throw new AppError("Google sign-in is awaiting publisher configuration. No account data has been collected.", 503);
  const state = random(), nonce = random(), verifier = random();
  const flow = await new EncryptJWT({ state, nonce, verifier }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("10m").setAudience("tidepath-oauth").setIssuer(publicOrigin()).encrypt(flowKey());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${publicOrigin()}/api/auth/google/callback`, response_type: "code", scope: "openid email", prompt: "select_account", state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { url: url.toString(), flow };
}
export async function finishGoogleSignIn(request: Request, dependencies: WebAuthDependencies = {}): Promise<{ token: string; identity: GoogleIdentity }> {
  const flow = cookieValue(request, FLOW_COOKIE);
  if (!flow) throw new AppError("Your sign-in session expired. Choose your Google account again.", 401);
  let payload;
  try { payload = (await jwtDecrypt(flow, flowKey(), { issuer: publicOrigin(), audience: "tidepath-oauth" })).payload; }
  catch { throw new AppError("Your sign-in session expired. Choose your Google account again.", 401); }
  const query = new URL(request.url).searchParams;
  const state = query.get("state") || "";
  const expected = String(payload.state || "");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(state) || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) throw new AppError("Sign-in verification failed. Start again from Tidepath.", 403);
  if (query.has("error")) throw new AppError("Google sign-in was cancelled. You can choose an account and try again.", 401);
  const code = query.get("code");
  if (!code || code.length > 4096) throw new AppError("Google did not return a valid sign-in code.", 401);
  if (!process.env.GOOGLE_WEB_CLIENT_ID || !process.env.GOOGLE_WEB_CLIENT_SECRET) throw new AppError("Google sign-in is awaiting publisher configuration.", 503);
  let response: Response;
  try {
    response = await (dependencies.fetch ?? fetch)("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_WEB_CLIENT_ID, client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET, code, code_verifier: String(payload.verifier), grant_type: "authorization_code", redirect_uri: `${publicOrigin()}/api/auth/google/callback` }), signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store" });
  } catch { throw new AppError("Google could not finish sign-in. Choose your account again.", 503); }
  if (!response.ok) throw new AppError("Google could not finish sign-in. Choose your account again.", 401);
  let tokens: { id_token?: unknown };
  try { tokens = await response.json(); } catch { throw new AppError("Google did not provide a verified identity.", 401); }
  if (typeof tokens.id_token !== "string") throw new AppError("Google did not provide a verified identity.", 401);
  const identity = await (dependencies.verify ?? verifyGoogleIdentity)(tokens.id_token, [process.env.GOOGLE_WEB_CLIENT_ID], { nonce: String(payload.nonce) });
  const token = random();
  await (dependencies.store ?? getPublicStore()).createSession(identity, hash(token), new Date(Date.now() + 8 * 3600_000));
  // Identity-only tokens are discarded; no offline Google access is requested.
  return { token, identity };
}
export async function googleSignInCallback(request: Request, dependencies: WebAuthDependencies = {}) {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  headers.append("Set-Cookie", cookie(FLOW_COOKIE, "", 0));
  try {
    const { token } = await finishGoogleSignIn(request, dependencies);
    headers.append("Set-Cookie", cookie(SESSION_COOKIE, token, 8 * 3600));
    // An explicit harmless query prevents hosting redirects from forwarding OAuth parameters.
    // The account page consumes this marker and clears its query before requesting account data.
    headers.set("Location", `${publicOrigin()}/account?signin=complete`);
  } catch { headers.set("Location", `${publicOrigin()}/account?error=signin`); }
  return new Response(null, { status: 303, headers });
}
export async function webIdentity(request: Request, dependencies: WebAuthDependencies = {}) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError("Sign in to your Tidepath account first.", 401);
  const identity = await (dependencies.store ?? getPublicStore()).readSession(hash(token));
  if (!identity) throw new AppError("Your session expired. Sign in again.", 401);
  return identity;
}
export async function endSession(request: Request, dependencies: WebAuthDependencies = {}) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await (dependencies.store ?? getPublicStore()).deleteSession(hash(token));
}
