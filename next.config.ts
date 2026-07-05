import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The hero video never changes for a given deploy — cache it hard so
        // returning visitors (and the CDN) never re-download 5MB.
        source: "/hero.mp4",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Baseline hardening on every response.
        source: "/:path*",
        headers: [
          // Browsers only ever talk HTTPS to us (2 years, incl. subdomains).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // No clickjacking: the site can't be put in someone else's iframe.
          { key: "X-Frame-Options", value: "DENY" },
          // Don't let browsers second-guess content types.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak full URLs (which can carry tokens) to other origins.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // We don't use camera/mic/geolocation — say so explicitly.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
