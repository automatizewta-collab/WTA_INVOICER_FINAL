import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["mssql", "tedious"],
   turbopack: {
    resolveAlias: {
      "@": "./src",
    },
  },    
};

export default nextConfig;
