import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the public Git SHA is embedded in the client build.
  env: {
    NEXT_PUBLIC_DEOPT_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
  },
};

export default nextConfig;
