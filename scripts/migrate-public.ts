import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { publicDatabasePool } from "../src/lib/public/storage";

async function migrate() {
 const pool = publicDatabasePool();
 const client = await pool.connect();
 try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(1748932017)");
  await client.query("CREATE TABLE IF NOT EXISTS tidepath_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const folder = resolve("migrations");
  for (const name of (await readdir(folder)).filter(name => /^\d+.*\.sql$/u.test(name)).sort()) {
    const prior = await client.query("SELECT 1 FROM tidepath_migrations WHERE name=$1", [name]);
    if (prior.rows.length) continue;
    await client.query(await readFile(resolve(folder, name), "utf8"));
    await client.query("INSERT INTO tidepath_migrations(name) VALUES($1)", [name]);
    console.log(`Applied ${name}`);
  }
  await client.query("COMMIT");
 } catch {
  await client.query("ROLLBACK");
  console.error("Public database migration failed. Check database reachability and migration privileges; credentials were not printed.");
  process.exitCode = 1;
 } finally { client.release(); await pool.end(); }
}
void migrate().catch(() => { console.error("Could not connect to the public database. Credentials were not printed."); process.exitCode = 1; });
