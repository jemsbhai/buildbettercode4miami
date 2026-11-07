import { googleSignInCallback } from "@/lib/public/web-auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return googleSignInCallback(request);
}
