import { finishGoogleSignIn, cookie, FLOW_COOKIE, SESSION_COOKIE } from "@/lib/public/web-auth";
import { publicOrigin } from "@/lib/public/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  headers.append("Set-Cookie", cookie(FLOW_COOKIE, "", 0));
  try {
    const { token } = await finishGoogleSignIn(request);
    headers.append("Set-Cookie", cookie(SESSION_COOKIE, token, 8 * 3600));
    headers.set("Location", `${publicOrigin()}/account`);
  } catch { headers.set("Location", `${publicOrigin()}/account?error=signin`); }
  return new Response(null, { status: 303, headers });
}
