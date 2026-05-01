import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "수익지출관리",
    short_name: "수익지출",
    description: "개인용 수익/지출 관리 웹앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
