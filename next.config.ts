import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
};

export default nextConfig;