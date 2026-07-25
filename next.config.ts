import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:locale/adm-barewbar-182203",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
