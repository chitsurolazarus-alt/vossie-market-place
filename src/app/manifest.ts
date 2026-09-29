import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vossie Market Place",
    short_name: "Vossie",
    description: "Student hustles. Campus customers.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16305e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
