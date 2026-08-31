import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Ad-credit writes must never be served from a cache.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
