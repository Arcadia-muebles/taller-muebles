import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Structure plans can be images or PDFs up to 10 MB. Leave room for multipart metadata.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
