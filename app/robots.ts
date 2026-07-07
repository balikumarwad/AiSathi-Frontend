import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/account", "/topup"],
    },
    sitemap: "https://aisathi.io/sitemap.xml",
  };
}
