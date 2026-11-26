import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Transiciones entre pantallas con <ViewTransition> (app/layout.tsx).
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
