import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // The end-to-end test builds into a folder of its own (apps/e2e).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@codegenie/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
