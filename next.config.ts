import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this directory so Next.js doesn't pick up a
  // sibling lockfile when this repo is cloned inside a monorepo checkout.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
