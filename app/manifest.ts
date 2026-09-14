import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "Todijo Marketplace", short_name: "Todijo", description: "Professional multi-vendor marketplace", start_url: "/?source=pwa", scope: "/", display: "standalone", orientation: "any", background_color: "#fffaf0", theme_color: "#073b2d", categories: ["shopping"], icons: [{ src: "/icon-192.png?v=4", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png?v=4", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icon-maskable-512.png?v=4", sizes: "512x512", type: "image/png", purpose: "maskable" }, { src: "/apple-icon.png?v=4", sizes: "180x180", type: "image/png" }] };
}
