import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root also contains a package-lock.json (the dev orchestrator), which
  // makes Next/Turbopack misdetect the project root and break module resolution
  // ("TypeError: adapterFn is not a function" on every request). Pin the root to
  // this directory so the client always resolves its own node_modules.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
