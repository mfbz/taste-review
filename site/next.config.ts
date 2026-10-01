import type { NextConfig } from "next";

// A static export: the site never calls the Taste Engine at runtime.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
