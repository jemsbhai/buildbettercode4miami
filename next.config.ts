import type { NextConfig } from "next";
const hostedBuild = Boolean(process.env.VERCEL || process.env.NETLIFY);
const config: NextConfig = {
  // Keep local public builds away from the demo; hosted Next adapters expect .next.
  distDir: process.env.TIDEPATH_PUBLIC_SERVICE === "1" && !hostedBuild ? ".next-public" : ".next",
  outputFileTracingExcludes: { "/*": ["./.data/**/*", "./.env*", "./.git/**/*", "./.vercel/**/*", "./.netlify/**/*", "./tests/**/*", "./integrations/**/*", "./docs/**/*", ...(!hostedBuild ? ["./.next/**/*"] : [])] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] },
    { source: "/api/auth/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    { source: "/account", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};
export default config;
