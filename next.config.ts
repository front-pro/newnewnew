import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "tesseract.js", "tesseract.js-core"],
  outputFileTracingIncludes: {
    "/api/files/parse": ["./assets/ocr/**/*", "./node_modules/tesseract.js/src/worker-script/**/*", "./node_modules/tesseract.js-core/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,

};

export default nextConfig;
