import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";
import { AppError } from "../service";

export type GoogleIdentity = { sub: string; email: string };
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), { timeoutDuration: 8_000 });

export type IdentityOptions = { nonce?: string; key?: JWTVerifyGetKey; now?: Date };

/** Google subject, never an email or a caller-supplied tenant, is the account key. */
export async function verifyGoogleIdentity(token: string, audiences: string[], options: IdentityOptions = {}): Promise<GoogleIdentity> {
  if (!audiences.length || audiences.some(audience => !audience.endsWith(".apps.googleusercontent.com"))) {
    throw new AppError("Google sign-in is not configured yet. Please try again after setup is complete.", 503);
  }
  if (!token || token.length > 12_000) throw new AppError("Sign in to Google again.", 401);
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, options.key ?? googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"], audience: audiences,
      algorithms: ["RS256"], requiredClaims: ["sub", "iat", "exp", "email", "email_verified"],
      currentDate: options.now, clockTolerance: 5, maxTokenAge: "2 hours",
    }));
  } catch { throw new AppError("Google sign-in expired or could not be verified. Sign in again.", 401); }
  if (typeof payload.sub !== "string" || !/^[A-Za-z0-9_-]{1,255}$/u.test(payload.sub)
    || typeof payload.email !== "string" || payload.email.length > 320 || payload.email_verified !== true
    || (typeof payload.azp === "string" && !audiences.includes(payload.azp))
    || (Array.isArray(payload.aud) && payload.aud.length > 1 && typeof payload.azp !== "string")
    || (options.nonce !== undefined && payload.nonce !== options.nonce)) {
    throw new AppError("Google identity did not match this sign-in request.", 401);
  }
  return { sub: payload.sub, email: payload.email };
}

export type AddonAuthDependencies = {
  audiences?: string[];
  verify?: typeof verifyGoogleIdentity;
  fetch?: typeof fetch;
};

export function addonAudiences() {
  return (process.env.GOOGLE_ADDON_CLIENT_ID ?? "").split(",").map(value => value.trim()).filter(Boolean);
}

/** Both tokens are short lived and remain in server request memory only. */
export async function authenticateAddon(headers: Headers, dependencies: AddonAuthDependencies = {}): Promise<GoogleIdentity> {
  const authorization = headers.get("authorization") ?? "";
  const accessToken = headers.get("x-tidepath-google-access-token") ?? "";
  if (!authorization.startsWith("Bearer ") || !accessToken || accessToken.length > 12_000 || /[\r\n]/u.test(accessToken)) {
    throw new AppError("Open Tidepath from Google Sheets and sign in again.", 401);
  }
  const identity = await (dependencies.verify ?? verifyGoogleIdentity)(authorization.slice(7), dependencies.audiences ?? addonAudiences());
  let response: Response;
  try {
    response = await (dependencies.fetch ?? fetch)("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
  } catch { throw new AppError("Google could not verify spreadsheet access. Please retry.", 503); }
  if (!response.ok) throw new AppError("Spreadsheet authorization expired. Reopen Tidepath and authorize Google access again.", response.status >= 500 ? 503 : 401);
  let userinfo: { sub?: unknown };
  try { userinfo = await response.json(); } catch { throw new AppError("Google returned an invalid identity response.", 503); }
  if (userinfo.sub !== identity.sub) throw new AppError("The spreadsheet and Tidepath Google accounts do not match. Use one Google account in this browser profile.", 403);
  return identity;
}
