import type { NextConfig } from "next";
import path from "path";

const appDir = __dirname;

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingRoot: appDir,
  turbopack: {
    root: appDir,
    resolveAlias: {
      tailwindcss: path.join(appDir, "node_modules/tailwindcss"),
      "@tailwindcss/postcss": path.join(appDir, "node_modules/@tailwindcss/postcss"),
    },
  },
  webpack: (config) => {
    config.context = appDir;
    config.resolve ??= {};
    config.resolve.modules = [
      path.join(appDir, "node_modules"),
      ...(config.resolve.modules ?? []),
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: path.resolve(appDir, "node_modules/tailwindcss"),
      "@tailwindcss/postcss": path.resolve(appDir, "node_modules/@tailwindcss/postcss"),
    };
    return config;
  },
};

export default nextConfig;