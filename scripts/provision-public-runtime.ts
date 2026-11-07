import { randomBytes } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import { publicDatabasePool } from "../src/lib/public/storage";

/** Operator-only: uses the migration owner to provision a separate limited login. */
async function provision() {
  const output = ".env.public.runtime.local";
  try { await access(output); throw new Error("A runtime credential file already exists; refusing to rotate it implicitly."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const pool = publicDatabasePool(); const client = await pool.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_roles WHERE rolname='tidepath_public_app'");
    if (existing.rows.length) throw new Error("Runtime login already exists. Use a reviewed credential rotation procedure.");
    const password = randomBytes(36).toString("base64url");
    await client.query("BEGIN");
    await client.query(`CREATE ROLE tidepath_public_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
    await client.query("GRANT tidepath_public_runtime TO tidepath_public_app");
    const url = new URL(process.env.DATABASE_URL ?? process.env.POSTGRES_URL!);
    url.username = "tidepath_public_app"; url.password = password; url.searchParams.set("sslmode", "verify-full");
    await writeFile(output, `DATABASE_URL=${JSON.stringify(url.toString())}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await client.query("COMMIT");
    console.log("Provisioned the restricted runtime login. Connection saved only in the ignored runtime environment file.");
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); await pool.end(); }
}
void provision().catch(() => { console.error("Runtime provisioning did not complete. Check role privileges and whether a runtime login/file already exists. Credentials were not printed."); process.exitCode = 1; });
