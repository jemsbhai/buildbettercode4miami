import test from "node:test";
import assert from "node:assert/strict";
import publicRetention from "../netlify/functions/public-retention.mjs";
import { PostgresWorkspaceStore } from "../src/lib/public/storage";

test("Netlify cleanup cannot run against a demo environment", async t => {
  const prior = process.env.TIDEPATH_PUBLIC_SERVICE;
  delete process.env.TIDEPATH_PUBLIC_SERVICE;
  t.after(() => { if (prior === undefined) delete process.env.TIDEPATH_PUBLIC_SERVICE; else process.env.TIDEPATH_PUBLIC_SERVICE = prior; });
  const purge = t.mock.method(PostgresWorkspaceStore.prototype, "purgeExpired", async () => ({ deletedWorkbooks: 0 }));
  await assert.rejects(publicRetention, /disabled outside the public service/u);
  assert.equal(purge.mock.callCount(), 0);
});

test("Netlify cleanup reports only successful deletion counts", async t => {
  const priorService = process.env.TIDEPATH_PUBLIC_SERVICE;
  const priorDatabase = process.env.DATABASE_URL;
  process.env.TIDEPATH_PUBLIC_SERVICE = "1";
  // The mocked purge never connects; a syntactically valid URL constructs the lazy pool.
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  t.after(() => {
    if (priorService === undefined) delete process.env.TIDEPATH_PUBLIC_SERVICE; else process.env.TIDEPATH_PUBLIC_SERVICE = priorService;
    if (priorDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = priorDatabase;
  });
  const purge = t.mock.method(PostgresWorkspaceStore.prototype, "purgeExpired", async () => ({ deletedWorkbooks: 2 }));
  const log = t.mock.method(console, "info", () => {});
  await publicRetention();
  assert.equal(purge.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls.map(call => JSON.parse(call.arguments[0])), [{ event: "tidepath.retention.complete", deletedWorkbooks: 2 }]);
});

test("Netlify cleanup failure never propagates database credentials into platform logs", async t => {
  const prior = process.env.TIDEPATH_PUBLIC_SERVICE;
  process.env.TIDEPATH_PUBLIC_SERVICE = "1";
  t.after(() => { if (prior === undefined) delete process.env.TIDEPATH_PUBLIC_SERVICE; else process.env.TIDEPATH_PUBLIC_SERVICE = prior; });
  t.mock.method(PostgresWorkspaceStore.prototype, "purgeExpired", async () => { throw new Error("postgres://owner:do-not-log@example.test/db"); });
  const log = t.mock.method(console, "info", () => {});
  await assert.rejects(publicRetention, error => {
    assert.equal((error as Error).message, "Tidepath retention cleanup failed. Retry from the function dashboard.");
    assert.equal((error as Error).cause, undefined);
    assert.doesNotMatch(String((error as Error).stack), /do-not-log/u);
    return true;
  });
  assert.equal(log.mock.callCount(), 0);
});
