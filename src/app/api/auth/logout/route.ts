import { endSession, cookie, SESSION_COOKIE } from "@/lib/public/web-auth";
import { publicError, requireSameOrigin, json } from "@/lib/public/http";
export async function POST(request: Request) {
  try { requireSameOrigin(request); await endSession(request); const response = json({ signedOut: true }); response.headers.set("Set-Cookie", cookie(SESSION_COOKIE, "", 0)); return response; }
  catch (error) { return publicError(error); }
}
