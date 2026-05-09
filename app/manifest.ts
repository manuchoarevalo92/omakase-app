import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Omakase App",
    short_name: "Omakase",
    description: "Gestión diaria de menú, platos e ingredientes.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    /** Preferir siempre ventana propia (sin UI del navegador). */
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
