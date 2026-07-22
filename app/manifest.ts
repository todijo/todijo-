import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Todijo Marketplace", short_name: "Todijo", description: "Professional multi-vendor marketplace", start_url: "/", display: "standalone", background_color: "#f3f7f5", theme_color: "#063d2d", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }] };
}
