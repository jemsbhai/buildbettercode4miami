import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createLocalJWKSet, EncryptJWT, exportJWK, generateKeyPair, jwtDecrypt, SignJWT } from "jose";
import { beginGoogleSignIn, cookie, cookieValue, endSession, finishGoogleSignIn, FLOW_COOKIE, SESSION_COOKIE, webIdentity, type WebAuthDependencies } from "../src/lib/public/web-auth";
import { publicOrigin } from "../src/lib/public/http";
import { verifyGoogleIdentity, type GoogleIdentity } from "../src/lib/public/auth";
import { AppError } from "../src/lib/service";

const origin = "https://tidepath.example";
const audience = "test-web-client.apps.googleusercontent.com";
const secret = "test-session-secret-with-more-than-forty-three-characters";
const principal = { sub: "verified-google-subject", email: "owner@example.test" };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function configured<T>(operation: () => Promise<T>) {
  const values = { TIDEPATH_PUBLIC_ORIGIN: origin, GOOGLE_WEB_CLIENT_ID: audience, GOOGLE_WEB_CLIENT_SECRET: "test-only-client-secret", TIDEPATH_SESSION_SECRET: secret };
  const prior = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return await operation(); } finally { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
function sessions() {
  const values = new Map<string, { identity: GoogleIdentity; expires: Date }>();
  const store: NonNullable<WebAuthDependencies["store"]> = {
    async createSession(identity, tokenHash, expires) { assert.match(tokenHash, /^[a-f0-9]{64}$/u); values.set(tokenHash, { identity, expires }); },
    async readSession(tokenHash) { const session = values.get(tokenHash); return session && session.expires.getTime() > Date.now() ? session.identity : null; },
    async deleteSession(tokenHash) { values.delete(tokenHash); },
  };
  return { values, store };
}
const flowKey = () => createHash("sha256").update(secret).digest();
const callback = (flow: string, state: string, extra = "code=google-code") => new Request(`${origin}/api/auth/google/callback?state=${encodeURIComponent(state)}&${extra}`, { headers: { cookie: `${FLOW_COOKIE}=${flow}` } });

test("Google sign-in explicitly selects an account and binds encrypted state, nonce and PKCE", () => configured(async () => {
  const { url, flow } = await beginGoogleSignIn();
  const authorization = new URL(url);
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("prompt"), "select_account");
  assert.equal(authorization.searchParams.get("scope"), "openid email");
  assert.equal(authorization.searchParams.get("redirect_uri"), `${origin}/api/auth/google/callback`);
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorization.searchParams.has("access_type"), false);
  const { payload } = await jwtDecrypt(flow, flowKey(), { issuer: origin, audience: "tidepath-oauth" });
  assert.equal(payload.state, authorization.searchParams.get("state"));
  assert.equal(payload.nonce, authorization.searchParams.get("nonce"));
  assert.equal(createHash("sha256").update(String(payload.verifier)).digest("base64url"), authorization.searchParams.get("code_challenge"));
  assert(!url.includes(String(payload.verifier))); assert(!url.includes("test-only-client-secret"));
  assert.equal((payload.exp! - payload.iat!), 600);
  const serialized = cookie(FLOW_COOKIE, flow, 600);
  assert.match(serialized, /Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600/u);
}));

test("OAuth callback rejects missing, changed, expired and mismatched state before contacting Google", () => configured(async () => {
  const { url, flow } = await beginGoogleSignIn(); const state = new URL(url).searchParams.get("state")!;
  let calls = 0;
  const dependencies: WebAuthDependencies = { fetch: async () => { calls++; throw new Error("must not contact provider"); } };
  await assert.rejects(finishGoogleSignIn(new Request(`${origin}/api/auth/google/callback?code=code&state=${state}`), dependencies), AppError);
  await assert.rejects(finishGoogleSignIn(callback(flow, "a".repeat(43)), dependencies), (error: unknown) => error instanceof AppError && error.status === 403);
  await assert.rejects(finishGoogleSignIn(callback(flow, "é".repeat(43)), dependencies), (error: unknown) => error instanceof AppError && error.status === 403);
  await assert.rejects(finishGoogleSignIn(callback(flow.slice(0, -4) + "aaaa", state), dependencies), AppError);
  const expired = await new EncryptJWT({ state, nonce: "nonce", verifier: "verifier" }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuer(origin).setAudience("tidepath-oauth").setExpirationTime(1).encrypt(flowKey());
  await assert.rejects(finishGoogleSignIn(callback(expired, state), dependencies), AppError);
  await assert.rejects(finishGoogleSignIn(callback(flow, state, "error=access_denied"), dependencies), /cancelled/u);
  assert.equal(calls, 0);
}));

test("OAuth callback verifies a signed Google nonce, discards provider tokens and stores only a session hash", () => configured(async () => {
  const { url, flow } = await beginGoogleSignIn();
  const { payload } = await jwtDecrypt(flow, flowKey());
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test", alg: "RS256" }] });
  const signed = (nonce: string) => new SignJWT({ email: principal.email, email_verified: true, nonce }).setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer("https://accounts.google.com").setSubject(principal.sub).setAudience(audience).setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const identityToken = await signed(String(payload.nonce));
  const saved = sessions(); let exchanges = 0;
  const dependencies: WebAuthDependencies = {
    store: saved.store,
    verify: (token, audiences, options) => verifyGoogleIdentity(token, audiences, { ...options, key }),
    fetch: async (endpoint, options) => {
      exchanges++;
      assert.equal(endpoint, "https://oauth2.googleapis.com/token");
      assert.equal(options?.redirect, "error"); assert.equal(options?.cache, "no-store");
      const form = options?.body as URLSearchParams;
      assert.equal(form.get("code_verifier"), payload.verifier); assert.equal(form.get("code"), "google-code");
      return Response.json({ id_token: identityToken, access_token: "must-not-be-persisted", refresh_token: "must-not-be-persisted" });
    },
  };
  const result = await finishGoogleSignIn(callback(flow, new URL(url).searchParams.get("state")!), dependencies);
  assert.deepEqual(result.identity, principal); assert.match(result.token, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(saved.values.size, 1); assert(saved.values.has(hash(result.token)));
  assert(!JSON.stringify([...saved.values]).includes("must-not-be-persisted"));
  assert(saved.values.get(hash(result.token))!.expires.getTime() <= Date.now() + 8 * 3600_000);
  assert.equal(exchanges, 1);
  const badNonce = await signed("other-signin-flow");
  await assert.rejects(finishGoogleSignIn(callback(flow, String(payload.state)), { ...dependencies, fetch: async () => Response.json({ id_token: badNonce }) }), /did not match/u);
  assert.equal(saved.values.size, 1);
}));

test("web sessions reject raw identity and expired values; logout revokes the stored session", () => configured(async () => {
  const saved = sessions(); const token = "a".repeat(43);
  const request = new Request(`${origin}/account`, { headers: { cookie: `email=attacker@example.test; ${SESSION_COOKIE}=${token}` } });
  await saved.store.createSession(principal, hash(token), new Date(Date.now() + 10000));
  assert.deepEqual(await webIdentity(request, { store: saved.store }), principal);
  assert.equal(cookieValue(request, SESSION_COOKIE), token);
  await endSession(request, { store: saved.store });
  await assert.rejects(webIdentity(request, { store: saved.store }), /expired/u);
  await assert.rejects(webIdentity(new Request(`${origin}/account`, { headers: { cookie: `email=${principal.email}; ${SESSION_COOKIE}=not-valid` } }), { store: saved.store }), /Sign in/u);
  await saved.store.createSession(principal, hash(token), new Date(Date.now() - 1));
  await assert.rejects(webIdentity(request, { store: saved.store }), /expired/u);
}));

test("misconfigured origins and unavailable Google responses fail without exposing credentials", () => configured(async () => {
  for (const invalid of ["https://user:password@tidepath.example", "https://tidepath.example/a", "https://tidepath.example?next=evil"]) {
    process.env.TIDEPATH_PUBLIC_ORIGIN = invalid; assert.throws(publicOrigin, AppError);
  }
  process.env.TIDEPATH_PUBLIC_ORIGIN = origin;
  const { url, flow } = await beginGoogleSignIn(); const state = new URL(url).searchParams.get("state")!;
  await assert.rejects(finishGoogleSignIn(callback(flow, state), { fetch: async () => { throw new Error("test-only-client-secret"); } }), (error: unknown) => error instanceof AppError && error.status === 503 && !error.message.includes("secret"));
  await assert.rejects(finishGoogleSignIn(callback(flow, state), { fetch: async () => new Response("broken", { status: 200 }) }), /verified identity/u);
}));
