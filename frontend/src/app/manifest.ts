import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/trend",
    name: "52주 트렌드 대시보드",
    short_name: "MTT Trend",
    description: "52주 고점 기반 테마 트렌드 분석 대시보드",
    start_url: "/trend",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111827",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

