import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow longer payloads for PDF uploads (default body limit is 1 MB).
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  // Pin pdfjs to be used externally so its workers/core resolve cleanly.
  serverExternalPackages: ["pdfjs-dist", "@openai/codex-sdk"],
};

export default nextConfig;
