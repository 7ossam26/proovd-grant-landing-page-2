import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal, self-contained server build for the Docker runner stage.
  output: "standalone",
};

export default nextConfig;
