import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  images: {
    // X already serves sized variants. Resizing through Vercel would let anyone
    // spend the image quota on arbitrary pbs.twimg.com URLs.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "pbs.twimg.com" }],
  },
};

export default nextConfig;
