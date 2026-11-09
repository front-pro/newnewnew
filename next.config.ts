import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  cacheComponents: true,
  partialPrefetching: true,

};

export default nextConfig;
