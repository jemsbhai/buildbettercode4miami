import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.TIDEPATH_PUBLIC_SERVICE === "1" || process.env.VERCEL ? ".next-public" : ".next",
  outputFileTracingExcludes: { "/*": ["./.data/**/*", "./.env*", "./.git/**/*", "./.vercel/**/*", "./.next/**/*", "./tests/**/*", "./integrations/**/*", "./docs/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default config;
