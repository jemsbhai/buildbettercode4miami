import { webIdentity, cookie, SESSION_COOKIE } from "@/lib/public/web-auth";
import { json, publicError, readJson, requireSameOrigin } from "@/lib/public/http";
import { getPublicStore } from "@/lib/public/storage";
import { AppError } from "@/lib/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const identity = await webIdentity(request); return json({ identity: { email: identity.email }, retentionDays: 30, workspace: "Personal workspace", sharing: "Private to your Google account" }); }
  catch (error) { return publicError(error); }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await webIdentity(request);
    const body = await readJson(request, 1000);
    if (body.confirmation !== "DELETE") throw new AppError("Type DELETE to remove your Tidepath account data.");
    await getPublicStore().deleteAccount(identity);
    const response = json({ deleted: true }); response.headers.set("Set-Cookie", cookie(SESSION_COOKIE, "", 0)); return response;
  } catch (error) { return publicError(error); }
}
