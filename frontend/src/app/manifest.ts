import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SuSagi — Public Cyber Safety",
    short_name: "SuSagi",
    description:
      "Evaluate suspicious messages, links, job offers, and screenshots with clear, evidence-based reasoning and safe-action guidance.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c1a",
    theme_color: "#1e5f66",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
