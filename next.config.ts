import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  devIndicators: {
    position: 'top-right',
  },
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
};

export default nextConfig;
