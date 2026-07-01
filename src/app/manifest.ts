import type { MetadataRoute } from "next";

// Web app manifest — makes CoachFit installable ("Add to Home Screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachFit — 1:1 Fitness Coaching",
    short_name: "CoachFit",
    description:
      "Track nutrition, weight and progress with your coach, and manage clients.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
