import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  cacheComponents: true,
  partialPrefetching: true,

};

export default nextConfig;
