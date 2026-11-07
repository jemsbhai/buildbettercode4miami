import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { PostgresWorkspaceStore } from "../src/lib/public/storage";
import { createPublicSheetsWorkspace } from "../src/lib/sheets";

const databaseUrl = process.env.TEST_PUBLIC_DATABASE_URL;

test("real PostgreSQL isolation, leases, sessions, retention and deletion", { skip: !databaseUrl }, async t => {
  const schema = `tidepath_test_${randomUUID().replaceAll("-", "")}`;
  const connection = new URL(databaseUrl!); connection.searchParams.set("sslmode", "verify-full");
  const admin = new Pool({ connectionString: connection.toString(), max: 1 });
  // Only this freshly generated schema is ever removed by the test.
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: connection.toString(), max: 4, options: `-c search_path=${schema},public` });
  const priorSecret = process.env.TIDEPATH_USAGE_SECRET;
  process.env.TIDEPATH_USAGE_SECRET = "test-only-usage-hmac-" + randomUUID();
  try {
    for (const file of (await readdir("migrations")).filter(file => /^\d+.*\.sql$/u.test(file)).sort()) await pool.query(await readFile(`migrations/${file}`, "utf8"));
    const store = new PostgresWorkspaceStore(pool);
    const alice = { sub: `test-alice-${randomUUID()}`, email: "alice@example.test" };
    const bob = { sub: `test-bob-${randomUUID()}`, email: "bob@example.test" };
    const workbookId = "test-workbook-shared-id";
    const fresh = () => createPublicSheetsWorkspace(workbookId);

    await t.test("the same workbook ID cannot reveal another user's records", async () => {
      await store.withWorkspace(alice, workbookId, fresh, async workspace => { workspace.state.revision = 41; });
      assert.equal(await store.readWorkspace(bob, workbookId), undefined);
      await store.withWorkspace(bob, workbookId, fresh, async workspace => { assert.notEqual(workspace.state.revision, 41); workspace.state.revision = 9; });
      assert.equal((await store.readWorkspace(alice, workbookId))?.state.revision, 41);
      assert.equal((await store.readWorkspace(bob, workbookId))?.state.revision, 9);
      const client = await pool.connect();
      try {
        await client.query("BEGIN"); await client.query("SET LOCAL ROLE tidepath_public_runtime");
        const unscoped = await client.query("SELECT * FROM tidepath_workspaces");
        assert.equal(unscoped.rowCount, 0, "Runtime RLS must fail closed without an organization setting");
        await client.query("COMMIT");
      } finally { client.release(); }
    });

    await t.test("parallel workers cannot acquire the same workbook lease", async () => {
      let entered!: () => void; let proceed!: () => void;
      const ready = new Promise<void>(resolve => { entered = resolve; });
      const hold = new Promise<void>(resolve => { proceed = resolve; });
      const first = store.withWorkspace(alice, workbookId, fresh, async (workspace, checkpoint) => {
        workspace.state.revision = 42; await checkpoint(workspace); entered(); await hold;
      });
      await ready;
      try { await assert.rejects(() => store.withWorkspace(alice, workbookId, fresh, async () => {}), /Another action/); }
      finally { proceed(); await first; }
      assert.equal((await store.readWorkspace(alice, workbookId))?.state.revision, 42);
    });

    await t.test("committed generation reservations survive an interrupted worker", async () => {
      await assert.rejects(() => store.withWorkspace(alice, workbookId, fresh, async (workspace, checkpoint) => {
        workspace.generationRequests.push({ requestId: "persisted-reservation", mode: "live", fingerprint: "fingerprint", status: "running", startedAt: new Date(Date.now() - 130_000).toISOString() });
        await checkpoint(workspace);
        workspace.state.revision = 999;
        throw new Error("simulated worker interruption");
      }), /simulated worker/);
      const recovered = await store.readWorkspace(alice, workbookId);
      assert.equal(recovered?.generationRequests[0].requestId, "persisted-reservation");
      assert.equal(recovered?.state.revision, 42, "uncommitted content is not saved on failure");
    });

    await t.test("an expired lease cannot overwrite a replacement worker's result", async () => {
      await assert.rejects(() => store.withWorkspace(alice, workbookId, fresh, async (workspace, checkpoint) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN"); await client.query("SET LOCAL ROLE tidepath_public_runtime");
          const account = await client.query("SELECT organization_id FROM tidepath_accounts WHERE google_subject=$1", [alice.sub]);
          await client.query("SELECT set_config('tidepath.organization_id',$1,true)", [account.rows[0].organization_id]);
          await client.query("UPDATE tidepath_workspaces SET lease_until=now()-interval '1 second' WHERE workbook_id=$1", [workbookId]);
          await client.query("COMMIT");
        } finally { client.release(); }
        await store.withWorkspace(alice, workbookId, fresh, async replacement => { replacement.state.revision = 43; });
        workspace.state.revision = 999;
        await checkpoint(workspace);
      }), /expired or its workbook was deleted/);
      assert.equal((await store.readWorkspace(alice, workbookId))?.state.revision, 43);
    });

    await t.test("deletion revokes a running worker and completion cannot recreate content", async () => {
      await assert.rejects(() => store.withWorkspace(alice, workbookId, fresh, async (workspace, checkpoint) => {
        await store.deleteWorkbook(alice, workbookId);
        await checkpoint(workspace);
      }), /expired or its workbook was deleted/);
      assert.equal(await store.readWorkspace(alice, workbookId), undefined);
      assert.equal((await store.readWorkspace(bob, workbookId))?.state.revision, 9);
    });

    await t.test("opaque session expiry and account deletion are enforced server-side", async () => {
      const tokenHash = "a".repeat(64);
      await store.createSession(alice, tokenHash, new Date(Date.now() + 60_000));
      assert.deepEqual(await store.readSession(tokenHash), alice);
      assert.equal(await store.readSession("b".repeat(64)), null);
      await assert.rejects(() => store.createSession(alice, "c".repeat(64), new Date(Date.now() - 1000)), /Invalid sign-in/);
      await pool.query("UPDATE tidepath_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenHash]);
      assert.equal(await store.readSession(tokenHash), null);
      await store.createSession(alice, "d".repeat(64), new Date(Date.now() + 60_000));
      await store.deleteAccount(alice);
      assert.equal(await store.readSession(tokenHash), null);
      assert.equal(await store.readSession("d".repeat(64)), null);
      assert.equal((await store.readWorkspace(bob, workbookId))?.state.revision, 9);
    });

    await t.test("usage caps survive account deletion and remain separate for users", async () => {
      for (let attempt = 0; attempt < 12; attempt++) await store.consumeUsage(alice, "generation");
      await store.deleteAccount(alice);
      await assert.rejects(() => store.consumeUsage(alice, "generation"), /twelve AI attempts/);
      await store.consumeUsage(bob, "generation");
    });

    await t.test("expired content is inaccessible before the cleanup job runs", async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const account = await client.query("SELECT organization_id FROM tidepath_accounts WHERE google_subject=$1", [bob.sub]);
        await client.query("SELECT set_config('tidepath.organization_id',$1,true)", [account.rows[0].organization_id]);
        await client.query("UPDATE tidepath_workspaces SET expires_at=now()-interval '1 second'");
        await client.query("COMMIT");
      } finally { client.release(); }
      assert.equal(await store.readWorkspace(bob, workbookId), undefined);
      assert.equal((await store.purgeExpired()).deletedWorkbooks, 1);
    });
  } finally {
    if (priorSecret === undefined) delete process.env.TIDEPATH_USAGE_SECRET; else process.env.TIDEPATH_USAGE_SECRET = priorSecret;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
