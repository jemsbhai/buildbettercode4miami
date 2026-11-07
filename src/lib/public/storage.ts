import { createHmac, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { AppError } from "../service";
import type { SheetsWorkspace } from "../sheets-types";
import type { GoogleIdentity } from "./auth";

type QueryClient = Pick<PoolClient, "query">;
type Lease = { token: string; organizationId: string; workbookId: string };
export type WorkspaceCheckpoint = (workspace: SheetsWorkspace) => Promise<void>;
let sharedPool: Pool | undefined;
let sharedStore: PostgresWorkspaceStore | undefined;
export function getPublicStore() { return sharedStore ??= new PostgresWorkspaceStore(); }

export function publicDatabasePool() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!databaseUrl) throw new AppError("Tidepath's secure storage is not configured yet.", 503);
  const url = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) url.searchParams.set("sslmode", "verify-full");
  sharedPool ??= new Pool({ connectionString: url.toString(), max: 3, connectionTimeoutMillis: 8_000, idleTimeoutMillis: 15_000,
    application_name: "tidepath-public", allowExitOnIdle: true });
  return sharedPool;
}

export function usageSubjectHash(subject: string) {
  const secret = process.env.TIDEPATH_USAGE_SECRET;
  if (!secret || secret.length < 32) throw new AppError("Tidepath usage protection is not configured yet.", 503);
  return createHmac("sha256", secret).update(subject).digest("hex");
}

function assertPublicWorkspace(workspace: SheetsWorkspace, workbookId: string) {
  if (!workspace || workspace.workbookId !== workbookId || workspace.version !== 1 || workspace.mode !== "public" || workspace.state?.reportScope !== "donations") {
    throw new AppError("Stored spreadsheet data could not be verified. Contact support before continuing.", 409);
  }
}

/** Each command is fenced by a durable lease. Provider work never holds a DB transaction open. */
export class PostgresWorkspaceStore {
  constructor(private readonly pool: Pool = publicDatabasePool()) {}

  private async transaction<T>(operation: (client: QueryClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); await client.query("SET LOCAL ROLE tidepath_public_runtime"); const result = await operation(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
    finally { client.release(); }
  }

  private async account(client: QueryClient, identity: GoogleIdentity, create = true): Promise<string | undefined> {
    if (create) {
      await client.query(`INSERT INTO tidepath_accounts (google_subject,organization_id,email) VALUES ($1,$2,$3)
        ON CONFLICT (google_subject) DO UPDATE SET email=EXCLUDED.email, updated_at=now()`, [identity.sub, randomUUID(), identity.email]);
      await client.query(`INSERT INTO tidepath_memberships (organization_id,google_subject,role)
        SELECT organization_id,google_subject,'owner' FROM tidepath_accounts WHERE google_subject=$1 ON CONFLICT DO NOTHING`, [identity.sub]);
    }
    const result = await client.query<{ organization_id: string }>(`SELECT a.organization_id FROM tidepath_accounts a
      JOIN tidepath_memberships m USING (organization_id,google_subject) WHERE a.google_subject=$1 AND m.role='owner' FOR UPDATE OF a`, [identity.sub]);
    const organizationId = result.rows[0]?.organization_id;
    if (organizationId) await client.query("SELECT set_config('tidepath.organization_id', $1, true)", [organizationId]);
    return organizationId;
  }

  async withWorkspace<T>(identity: GoogleIdentity, workbookId: string, create: () => SheetsWorkspace,
    operation: (workspace: SheetsWorkspace, checkpoint: WorkspaceCheckpoint) => Promise<T>): Promise<T> {
    const { lease, workspace } = await this.transaction(async client => {
      const organizationId = (await this.account(client, identity))!;
      // Expired content cannot be revived by reading it.
      await client.query("DELETE FROM tidepath_workspaces WHERE organization_id=$1 AND expires_at<=now() AND (lease_until IS NULL OR lease_until<now())", [organizationId]);
      const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM tidepath_workspaces WHERE organization_id=$1", [organizationId]);
      const existing = await client.query<{ state: SheetsWorkspace }>("SELECT state FROM tidepath_workspaces WHERE organization_id=$1 AND workbook_id=$2", [organizationId, workbookId]);
      if (!existing.rows.length) {
        if (Number(count.rows[0].count) >= 10) throw new AppError("Your private workspace supports ten spreadsheets. Delete an unused Tidepath workbook before adding another.", 429);
        const initial = create();
        assertPublicWorkspace(initial, workbookId);
        await client.query("INSERT INTO tidepath_workspaces (organization_id,workbook_id,state) VALUES ($1,$2,$3::jsonb)", [organizationId, workbookId, JSON.stringify(initial)]);
      }
      const token = randomUUID();
      const acquired = await client.query<{ state: SheetsWorkspace }>(`UPDATE tidepath_workspaces SET lease_token=$3,lease_until=now()+interval '120 seconds'
        WHERE organization_id=$1 AND workbook_id=$2 AND (lease_until IS NULL OR lease_until<now()) RETURNING state`, [organizationId, workbookId, token]);
      if (!acquired.rows.length) throw new AppError("Another action is running for this spreadsheet. Wait briefly, then retry the same action.", 409);
      assertPublicWorkspace(acquired.rows[0].state, workbookId);
      return { lease: { token, organizationId, workbookId }, workspace: acquired.rows[0].state };
    });
    const checkpoint: WorkspaceCheckpoint = value => this.save(lease, value);
    try { const result = await operation(workspace, checkpoint); await checkpoint(workspace); return result; }
    finally {
      await this.transaction(async client => {
        await client.query("SELECT set_config('tidepath.organization_id', $1, true)", [lease.organizationId]);
        await client.query("UPDATE tidepath_workspaces SET lease_token=NULL,lease_until=NULL WHERE organization_id=$1 AND workbook_id=$2 AND lease_token=$3", [lease.organizationId, workbookId, lease.token]);
      });
    }
  }

  private async save(lease: Lease, workspace: SheetsWorkspace) {
    assertPublicWorkspace(workspace, lease.workbookId);
    const serialized = JSON.stringify(workspace);
    if (Buffer.byteLength(serialized, "utf8") > 5_000_000) throw new AppError("This Tidepath workbook reached its storage limit. Export needed reports, then delete its stored Tidepath data before starting a new workspace.", 413);
    await this.transaction(async client => {
      await client.query("SELECT set_config('tidepath.organization_id', $1, true)", [lease.organizationId]);
      const result = await client.query(`UPDATE tidepath_workspaces SET state=$4::jsonb,version=version+1,updated_at=now(),expires_at=now()+interval '30 days'
        WHERE organization_id=$1 AND workbook_id=$2 AND lease_token=$3 AND lease_until>now()`, [lease.organizationId, lease.workbookId, lease.token, serialized]);
      if (result.rowCount !== 1) throw new AppError("This action expired or its workbook was deleted. Refresh before continuing.", 409);
    });
  }

  async readWorkspace(identity: GoogleIdentity, workbookId: string): Promise<SheetsWorkspace | undefined> {
    return this.transaction(async client => {
      const organizationId = await this.account(client, identity, false);
      if (!organizationId) return undefined;
      const result = await client.query<{ state: SheetsWorkspace }>("SELECT state FROM tidepath_workspaces WHERE organization_id=$1 AND workbook_id=$2 AND expires_at>now()", [organizationId, workbookId]);
      if (result.rows[0]) assertPublicWorkspace(result.rows[0].state, workbookId);
      return result.rows[0]?.state;
    });
  }

  async deleteWorkbook(identity: GoogleIdentity, workbookId: string) {
    await this.transaction(async client => {
      const organizationId = await this.account(client, identity, false);
      if (!organizationId) return;
      // Removing a running workspace revokes its lease; its completion cannot recreate it.
      await client.query("DELETE FROM tidepath_workspaces WHERE organization_id=$1 AND workbook_id=$2", [organizationId, workbookId]);
    });
  }

  async deleteAccount(identity: GoogleIdentity) {
    await this.transaction(async client => {
      const organizationId = await this.account(client, identity, false);
      if (!organizationId) return;
      await client.query("DELETE FROM tidepath_workspaces WHERE organization_id=$1", [organizationId]);
      await client.query("DELETE FROM tidepath_accounts WHERE google_subject=$1", [identity.sub]);
    });
  }

  async createSession(identity: GoogleIdentity, tokenHash: string, expiresAt: Date) {
    if (!/^[a-f0-9]{64}$/u.test(tokenHash) || expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 31 * 86_400_000) throw new AppError("Invalid sign-in session.");
    await this.transaction(async client => {
      await this.account(client, identity);
      await client.query("DELETE FROM tidepath_sessions WHERE google_subject=$1 AND expires_at<=now()", [identity.sub]);
      await client.query("INSERT INTO tidepath_sessions(token_hash,google_subject,expires_at) VALUES($1,$2,$3)", [tokenHash, identity.sub, expiresAt]);
    });
  }

  async readSession(tokenHash: string): Promise<GoogleIdentity | null> {
    if (!/^[a-f0-9]{64}$/u.test(tokenHash)) return null;
    return this.transaction(async client => {
      const result = await client.query<{ google_subject: string; email: string }>(`SELECT a.google_subject,a.email FROM tidepath_sessions s
        JOIN tidepath_accounts a USING(google_subject) WHERE s.token_hash=$1 AND s.expires_at>now()`, [tokenHash]);
      return result.rows[0] ? { sub: result.rows[0].google_subject, email: result.rows[0].email } : null;
    });
  }

  async deleteSession(tokenHash: string) { await this.transaction(async client => { await client.query("DELETE FROM tidepath_sessions WHERE token_hash=$1", [tokenHash]); }); }

  async consumeUsage(identity: GoogleIdentity, kind: "command" | "generation", now = new Date()) {
    const bucket = now.toISOString().slice(0, kind === "command" ? 13 : 10);
    const limit = kind === "command" ? 120 : 12;
    await this.transaction(async client => {
      const increment = (subject: string, cap: number) => client.query(`INSERT INTO tidepath_usage(subject_hash,bucket,kind,attempts,expires_at) VALUES($1,$2,$3,1,now()+interval '30 days')
        ON CONFLICT(subject_hash,bucket,kind) DO UPDATE SET attempts=tidepath_usage.attempts+1 WHERE tidepath_usage.attempts<$4 RETURNING attempts`,
      [usageSubjectHash(subject), bucket, kind, cap]);
      if (!(await increment(identity.sub, limit)).rows.length) throw new AppError(kind === "generation" ? "Today's twelve AI attempts have been used. Try again tomorrow or use a calculated report." : "Too many actions in this hour. Please wait before retrying.", 429);
      // A small launch-wide ceiling also bounds provider exposure across many accounts.
      if (kind === "generation" && !(await increment("$tidepath-global-generation", 100)).rows.length) throw new AppError("Tidepath's daily AI capacity has been reached. Calculated reports remain available; try AI again tomorrow.", 429);
    });
  }

  /** Cron uses account-scoped transactions, so row-level security is never bypassed. */
  async purgeExpired() {
    const accounts = await this.transaction(client => client.query<{ google_subject: string; email: string }>("SELECT google_subject,email FROM tidepath_accounts"));
    let deleted = 0;
    for (const row of accounts.rows) {
      await this.transaction(async client => {
        const organizationId = await this.account(client, { sub: row.google_subject, email: row.email }, false);
        if (organizationId) {
          const result = await client.query("DELETE FROM tidepath_workspaces WHERE organization_id=$1 AND expires_at<=now() AND (lease_until IS NULL OR lease_until<now())", [organizationId]);
          deleted += result.rowCount ?? 0;
        }
      });
    }
    await this.transaction(async client => {
      await client.query("DELETE FROM tidepath_usage WHERE expires_at<=now()");
      await client.query("DELETE FROM tidepath_sessions WHERE expires_at<=now()");
    });
    return { deletedWorkbooks: deleted };
  }
}
