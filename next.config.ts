import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase free plan: 5 MB per file. FormData overhead makes the request
  // slightly larger; 100 MB is a comfortable ceiling.
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
