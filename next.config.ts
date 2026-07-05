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
    ];
  },
};

export default nextConfig;
