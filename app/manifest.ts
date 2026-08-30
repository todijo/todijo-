import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "Todijo Marketplace", short_name: "Todijo", description: "Professional multi-vendor marketplace", start_url: "/?source=pwa", scope: "/", display: "standalone", orientation: "any", background_color: "#16074c", theme_color: "#16074c", categories: ["shopping"], icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }, { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }] };
}
