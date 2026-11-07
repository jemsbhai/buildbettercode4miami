import assert from "node:assert/strict";
const origin = process.env.TIDEPATH_VERIFY_URL || "https://tidepath-sheets.vercel.app";
const url = new URL(origin);
assert.equal(url.protocol, "https:", "Verify the actual HTTPS deployment");
let checks = 0;
for (const path of ["/", "/privacy", "/support", "/terms", "/install", "/account"]) {
  const response = await fetch(new URL(path, origin), { redirect: "manual" });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  const text = await response.text();
  assert.match(text, /Tidepath/);
  assert.doesNotMatch(text, /Reset demo/);
  checks++;
}
for (const [path, expected] of [["/api/dashboard",404],["/api/notes/example",404],["/api/public/account",401],["/api/public/retention",401]]) {
  const response = await fetch(new URL(path, origin), { redirect:"manual" });
  assert.equal(response.status, expected, path);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  checks++;
}
for (const body of [{ workbookId:"forged-workbook-id", action:"status" }, { workbookId:"forged-workbook-id", action:"reset" }]) {
  const response=await fetch(new URL("/api/public/command",origin),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  assert.equal(response.status,401,"Unauthenticated workbook command"); checks++;
}
const forged=await fetch(new URL("/api/public/command",origin),{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://attacker.example","Authorization":"Bearer forged","X-Tidepath-Google-Access-Token":"forged"},body:JSON.stringify({workbookId:"forged-workbook-id",action:"status"})});
assert.equal(forged.status,403); checks++;
const health=await fetch(new URL("/api/public/health",origin)); assert.equal(health.status,200); assert.equal((await health.json()).service,"tidepath-sheets"); checks++;
console.log(`${checks} hosted public-page and access-control checks passed for ${origin}.`);
console.log("This does not verify Google OAuth, native installation, or the user-workbook workflow.");
