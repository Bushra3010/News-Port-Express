import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep postgres.js out of the Next bundle. Next would inline its Node build
  // (node:net / node:tls); left external, OpenNext resolves it with the
  // "workerd" condition instead and picks the cloudflare:sockets build.
  serverExternalPackages: ["postgres"],
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "2mb" }, authInterrupts: true },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: security },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
