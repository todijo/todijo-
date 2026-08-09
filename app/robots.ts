import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/*/dashboard", "/*/account/", "/*/seller/", "/*/checkout", "/*/cart",
        "/*/messages", "/*/favorites", "/*/connect/", "/*/login", "/*/register", "/*/forgot-password",
        "/*/reset-password", "/*/verify-email", "/*/e2e-ux", "/*/adm-barewbar-182203", "/*/search",
      ],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
