import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soft Study Notes",
    short_name: "StudyNotes",
    description: "手書き・表編集に対応した学習向けWebノート",
    start_url: "/",
    display: "standalone",
    background_color: "#f5e2f2",
    theme_color: "#f5e2f2",
    lang: "ja",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
