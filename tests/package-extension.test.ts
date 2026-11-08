import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const exec = promisify(execFile);
const localClient = "1234-local-test.apps.googleusercontent.com";
const storeClient = "1234-store-test.apps.googleusercontent.com";
const expectedFiles = ["README.txt", "manifest.json", "app.html", "app.mjs", "styles.css", "service-worker.mjs", "bridge.mjs", "controller.mjs", "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"].sort();

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "tidepath-package-test-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(join(resolve(tmpdir()), "tidepath-package-test-")));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "scripts"));
  await cp("scripts/package-extension.mjs", join(directory, "scripts/package-extension.mjs"));
  await cp("extension", join(directory, "extension"), { recursive: true });
  return {
    directory,
    package: (...args: string[]) => exec(process.execPath, [join(directory, "scripts/package-extension.mjs"), ...args]),
  };
}

function zipEntries(archive: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(archive.readUInt16LE(offset + 8), 0, "fixture reader expects stored ZIP entries");
    const length = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    assert.ok(!entries.has(name));
    entries.set(name, archive.subarray(start, start + length));
    offset = start + length;
  }
  assert.equal(archive.readUInt32LE(offset), 0x02014b50);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
  assert.equal(archive.readUInt16LE(archive.length - 12), entries.size);
  return entries;
}

test("isolated release packaging preserves the configured local build and includes only approved assets", async t => {
  const f = await fixture(t);
  await f.package("--oauth-client-id", localClient);
  const localManifest = await readFile(join(f.directory, "out/tidepath-extension/manifest.json"));
  const localZip = await readFile(join(f.directory, "out/tidepath-extension.zip"));
  await writeFile(join(f.directory, "extension/private-evidence.json"), "private-fixture-sentinel");
  await writeFile(join(f.directory, ".env.local"), "SECRET=private-fixture-sentinel");
  const sourceManifest = await readFile(join(f.directory, "extension/manifest.json"));

  await f.package("--output-name", "tidepath-extension-store", "--oauth-client-id", storeClient);
  const releasePath = join(f.directory, "out/tidepath-extension-store.zip");
  const releaseZip = await readFile(releasePath);
  assert.deepEqual(await readFile(join(f.directory, "out/tidepath-extension/manifest.json")), localManifest);
  assert.deepEqual(await readFile(join(f.directory, "out/tidepath-extension.zip")), localZip);
  assert.deepEqual(await readFile(join(f.directory, "extension/manifest.json")), sourceManifest);
  const entries = zipEntries(releaseZip);
  assert.deepEqual([...entries.keys()].sort(), expectedFiles);
  assert.ok(!releaseZip.includes(Buffer.from("private-fixture-sentinel")));
  const manifest = JSON.parse(entries.get("manifest.json")!.toString("utf8"));
  assert.equal(manifest.name, "Tidepath — local Sheets review");
  assert.equal(manifest.oauth2.client_id, storeClient);
  assert.equal(manifest.oauth2.scopes.length, 3);
  const readme = entries.get("README.txt")!.toString("utf8");
  assert.match(readme, /GOOGLE AUTHORIZATION CONFIGURED/);
  assert.match(readme, /Public users do not need to rebuild the extension or create their own OAuth client/);
  assert.match(readme, /Chrome Web Store listing is published/);
  assert.match(readme, /https:\/\/github.com\/jemsbhai\/buildbettercode4miami\/blob\/codex\/tidepath-mvp\/docs\/EXTENSION.md/);
  assert.match(readme, /npm run sheets:local -- --extension-id YOUR_EXTENSION_ID\n/);
  assert.doesNotMatch(readme, /--oauth-client-id|--demo|DRAFT \/ FICTIONAL FIXTURE ONLY/);
  for (const size of [16, 32, 48, 128]) {
    const path = `icons/icon-${size}.png`;
    assert.equal(manifest.icons[size], path);
    assert.equal(manifest.action.default_icon[size], path);
    const png = entries.get(path)!;
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.deepEqual(await readFile(join(f.directory, "out/tidepath-extension-store", path)), png);
  }
  await f.package("--oauth-client-id", storeClient, "--output-name", "tidepath-extension-store");
  assert.deepEqual(await readFile(releasePath), releaseZip, "same inputs produce the same ZIP");
});

test("an isolated default-auth package remains unconfigured", async t => {
  const f = await fixture(t);
  await f.package("--output-name", "tidepath-store-draft");
  const manifest = JSON.parse(await readFile(join(f.directory, "out/tidepath-store-draft/manifest.json"), "utf8"));
  assert.equal(manifest.oauth2, undefined);
  const entries = zipEntries(await readFile(join(f.directory, "out/tidepath-store-draft.zip")));
  const readme = entries.get("README.txt")!.toString("utf8");
  assert.match(readme, /DRAFT \/ FICTIONAL FIXTURE ONLY/);
  assert.match(readme, /not ready to submit for Chrome Web Store review or public installation/);
  assert.match(readme, /--extension-id YOUR_EXTENSION_ID --demo/);
  assert.match(readme, /--oauth-client-id/);
  assert.doesNotMatch(readme, /GOOGLE AUTHORIZATION CONFIGURED/);
  assert.deepEqual((await readdir(join(f.directory, "out"))).sort(), ["tidepath-store-draft", "tidepath-store-draft.zip"]);
});

test("invalid package destinations and duplicate or unknown options fail before writing", async t => {
  const f = await fixture(t);
  for (const args of [
    ["--output-name", "../tidepath-extension"],
    ["--output-name", "C:\\outside"],
    ["--output-name", "nested/folder"],
    ["--output-name", "/absolute"],
    ["--output-name", ""],
    ["--output-name"],
    ["--output-name", "one", "--output-name", "two"],
    ["--oauth-client-id", localClient, "--oauth-client-id", storeClient],
    ["--oauth-client-id", "not-a-client"],
    ["--unknown", "value"],
  ]) await assert.rejects(f.package(...args), /Usage:/);
  assert.ok(!(await readdir(f.directory)).includes("out"));
});
