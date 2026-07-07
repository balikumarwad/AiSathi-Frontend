import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/models", "/playground", "/docs", "/login", "/privacy", "/terms"];
  return pages.map((p) => ({
    url: `https://aisathi.io${p}`,
    changeFrequency: p === "/models" ? "daily" : "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
