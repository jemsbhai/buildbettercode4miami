import { createHash, timingSafeEqual } from "node:crypto";
import { getPublicStore } from "@/lib/public/storage";
import { json, publicError } from "@/lib/public/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!secret || !timingSafeEqual(hash(request.headers.get("authorization") || ""), hash(`Bearer ${secret}`))) return json({ error: "Unauthorized" }, 401);
  try { await getPublicStore().purgeExpired(); return json({ purged: true }); }
  catch (error) { return publicError(error); }
}
