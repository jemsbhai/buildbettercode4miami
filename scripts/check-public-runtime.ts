import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { publicDatabasePool, PostgresWorkspaceStore } from "../src/lib/public/storage";
import { createPublicSheetsWorkspace } from "../src/lib/sheets";

/** Uses only two unique synthetic identities; cleanup removes only those identities. */
async function check() {
  const pool = publicDatabasePool(); const store = new PostgresWorkspaceStore(pool);
  const suffix = randomUUID();
  const alice = { sub: `runtime-check-alice-${suffix}`, email: "runtime-check-alice@example.test" };
  const bob = { sub: `runtime-check-bob-${suffix}`, email: "runtime-check-bob@example.test" };
  const workbookId = `runtime-check-workbook-${suffix}`;
  try {
    const login = await pool.query<{ rolbypassrls: boolean; rolcreaterole: boolean; rolsuper: boolean }>("SELECT rolbypassrls,rolcreaterole,rolsuper FROM pg_roles WHERE rolname=current_user");
    assert.deepEqual(login.rows[0], { rolbypassrls: false, rolcreaterole: false, rolsuper: false });
    const create = () => createPublicSheetsWorkspace(workbookId);
    await store.withWorkspace(alice, workbookId, create, async workspace => { workspace.state.revision = 2718; });
    assert.equal(await store.readWorkspace(bob, workbookId), undefined);
    await store.withWorkspace(bob, workbookId, create, async workspace => { assert.notEqual(workspace.state.revision, 2718); });
    assert.equal((await store.readWorkspace(alice, workbookId))?.state.revision, 2718);
    const client = await pool.connect();
    try {
      await client.query("BEGIN"); await client.query("SET LOCAL ROLE tidepath_public_runtime");
      const unscoped = await client.query("SELECT * FROM tidepath_workspaces WHERE workbook_id=$1", [workbookId]);
      assert.equal(unscoped.rowCount, 0);
      await client.query("COMMIT");
    } finally { client.release(); }
    console.log("Restricted production login verified: no administrative/RLS bypass privileges, tenant separation and fail-closed RLS passed.");
  } finally { await store.deleteAccount(alice); await store.deleteAccount(bob); await pool.end(); }
}
void check().catch(() => { console.error("Restricted runtime verification failed. Credentials were not printed."); process.exitCode = 1; });
