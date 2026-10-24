import type { MetadataRoute } from "next";

// Installable from the browser ("Add to Home Screen"), so workers get an app icon without an app store.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Payslip",
    short_name: "Payslip",
    description: "Salary records you own, signed by both sides every month.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e6",
    theme_color: "#f4f0e6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
