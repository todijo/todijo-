import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Todijo Marketplace", short_name: "Todijo", description: "Professional multi-vendor marketplace", start_url: "/", display: "standalone", background_color: "#faf7ff", theme_color: "#5b21b6", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }] };
}
