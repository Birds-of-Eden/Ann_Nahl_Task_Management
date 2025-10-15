import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['drive.google.com'], // ✅ This solves the next/image error
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // ✅ Performance Optimizations
  experimental: {
    optimizePackageImports: ['@prisma/client', 'lucide-react'],
  },
  
  // ✅ Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // ✅ Static page generation
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

export default nextConfig;
