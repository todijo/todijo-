import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // `next dev` and `next build` must never write into the same output directory.
  // Keeping development artifacts separate prevents a live dev compiler from
  // replacing a production runtime while it still references production chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" + (process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "") },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), usb=()" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/.well-known/assetlinks.json", headers: [{ key: "Cache-Control", value: "public, max-age=300" }, { key: "Content-Type", value: "application/json; charset=utf-8" }] },
      { source: "/:locale/adm-barewbar-182203", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
