import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A price, an order status and an entitlement must never be served from a
    // cache. Every one of them can change between two page loads, and the one
    // that matters most is a customer refreshing to see whether their eSIM has
    // arrived yet.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
