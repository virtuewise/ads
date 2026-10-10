import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@printsync/shared', '@printsync/creative-engine'],
};

export default nextConfig;
