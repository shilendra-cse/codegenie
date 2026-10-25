import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // The end-to-end test builds into a folder of its own (apps/e2e).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@hobai/shared"],
  images: {
    // Next's defaults plus 192: the full logo (96px wide) is then served at exactly its retina size, unscaled.
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256, 384],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
