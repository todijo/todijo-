import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // `next dev` and `next build` must never write into the same output directory.
  // Keeping development artifacts separate prevents a live dev compiler from
  // replacing a production runtime while it still references production chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async headers() {
    return [{
      source: "/:locale/adm-barewbar-182203",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
