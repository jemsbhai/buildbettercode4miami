import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PostgresWorkspaceStore, publicDatabasePool } from "../src/lib/public/storage";
import { SESSION_COOKIE } from "../src/lib/public/web-auth";

/**
 * Operator smoke test: seeds one synthetic session through the restricted database
 * login, then verifies the deployed HTTP -> database boundary. This is deliberately
 * not described as Google OAuth or native Sheets end-to-end verification.
 */
async function verify() {
  const origin = new URL(process.env.TIDEPATH_VERIFY_URL ?? "https://tidepath.muntasersyed.com");
  assert(origin.protocol === "https:" && !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash,
    "The verification target must be an HTTPS origin without credentials or a path.");
  const suffix = randomUUID();
  const identity = { sub: `hosted-smoke-${suffix}`, email: `hosted-smoke-${suffix}@example.test` };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const store = new PostgresWorkspaceStore(publicDatabasePool());
  const endpoint = new URL("/api/public/account", origin);
  let phase = "create short-lived synthetic session";
  let checks = 0;
  const request = (method: "GET" | "DELETE", suppliedToken = token, requestOrigin?: string, confirmation?: string) => fetch(endpoint, {
    method, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000),
    headers: { Cookie: `${SESSION_COOKIE}=${suppliedToken}`,
      ...(requestOrigin ? { Origin: requestOrigin } : {}), ...(method === "DELETE" ? { "Content-Type": "application/json" } : {}) },
    body: method === "DELETE" ? JSON.stringify({ confirmation }) : undefined,
  });
  try {
    await store.createSession(identity, tokenHash, new Date(Date.now() + 5 * 60_000));

    phase = "valid synthetic session returns the matching account";
    const valid = await request("GET");
    assert.equal(valid.status, 200);
    assert.match(valid.headers.get("cache-control") ?? "", /no-store/);
    const account = await valid.json();
    assert.equal(account.identity?.email, identity.email);
    assert.equal(account.sharing, "Private to your Google account");
    checks++;

    phase = "forged opaque cookie is rejected";
    assert.equal((await request("GET", randomBytes(32).toString("base64url"))).status, 401); checks++;

    phase = "cross-origin account deletion is rejected";
    assert.equal((await request("DELETE", token, "https://attacker.example", "DELETE")).status, 403); checks++;

    phase = "rejected cross-origin deletion preserves the synthetic session";
    assert.equal((await request("GET")).status, 200); checks++;

    phase = "deletion requires explicit confirmation";
    assert.equal((await request("DELETE", token, origin.origin, "KEEP")).status, 400); checks++;

    phase = "same-origin confirmed deletion removes only the synthetic account";
    const deleted = await request("DELETE", token, origin.origin, "DELETE");
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { deleted: true });
    assert.match(deleted.headers.get("set-cookie") ?? "", /Max-Age=0/);
    checks++;

    phase = "a deleted session cannot be replayed";
    assert.equal((await request("GET")).status, 401); checks++;

    phase = "the hosted deletion is visible through the actual restricted database";
    assert.equal(await store.readSession(tokenHash), null); checks++;
    console.log(`${checks} hosted synthetic-session, origin-protection and database-deletion checks passed for ${origin.origin}.`);
    console.log("This seeds a synthetic session directly in the database; it does not verify Google OAuth, native add-on installation, or a user-owned workbook.");
  } catch {
    // Never print cookies, database URLs, full request objects or provider exception bodies.
    console.error(`Hosted session verification failed during: ${phase}. Credentials were not printed.`);
    process.exitCode = 1;
  } finally {
    try { await store.deleteAccount(identity); }
    catch { console.error(`Synthetic account cleanup could not be confirmed. The only cleanup target is Google subject ${identity.sub}. Credentials were not printed.`); process.exitCode = 1; }
    await publicDatabasePool().end();
  }
}
void verify().catch(() => { console.error("Hosted session verification could not start. Check the HTTPS target and restricted database connection."); process.exitCode = 1; });
