import { AppError } from "../service";
import { ZodError } from "zod";

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function publicOrigin() {
  const value = process.env.TIDEPATH_PUBLIC_ORIGIN;
  if (!value) throw new AppError("Tidepath is completing its hosting setup. Please try again later.", 503);
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new AppError("The public origin must contain only the HTTPS site origin.", 503);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new AppError("The public origin must use HTTPS.", 503);
  return url.origin;
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get("origin") !== publicOrigin()) throw new AppError("Reopen your Tidepath account page before continuing.", 403);
}

export async function readJson(request: Request, limit = 1_000_000): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|\s*$)/iu.test(request.headers.get("content-type") ?? "")) throw new AppError("Send a JSON request.", 415);
  if (Number(request.headers.get("content-length")) > limit) throw new AppError("The selected table exceeds the one-megabyte limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Request body is required.");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AppError("The selected table exceeds the one-megabyte limit.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError("Request must contain valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("Request must be a JSON object.");
  return value as Record<string, unknown>;
}

export function publicError(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message, issues: error.issues }, error.status);
  if (error instanceof ZodError) return json({ error: "Some fields are invalid. Check the selected table and try again.", fields: error.issues.map(issue => issue.path.join(".")) }, 400);
  // Provider errors can contain credentials, request bodies and donor data. Never echo them.
  return json({ error: "Tidepath could not complete this action. Your source sheet is unchanged. Retry the same action; if the problem continues, contact support." }, 503);
}
