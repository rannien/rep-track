import type { MetadataRoute } from "next";

// Web app manifest — makes Rep Track installable to the home screen and drives
// the standalone (chrome-less) launch. Next serves this at /manifest.webmanifest
// and injects the <link rel="manifest"> automatically. The SVG icon carries
// its own solid indigo tile, so it doubles as the maskable icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rep Track",
    short_name: "Rep Track",
    description:
      "Log every set with weight and reps, track estimated 1RM and personal records, and rest on time.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4b50d5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
