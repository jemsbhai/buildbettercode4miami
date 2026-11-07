import { beginGoogleSignIn, cookie, FLOW_COOKIE } from "@/lib/public/web-auth";
import { publicOrigin } from "@/lib/public/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    const { url, flow } = await beginGoogleSignIn();
    return new Response(null, { status: 303, headers: { Location: url, "Set-Cookie": cookie(FLOW_COOKIE, flow, 600), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return Response.redirect(`${publicOrigin()}/account?error=setup`, 303);
  }
}
