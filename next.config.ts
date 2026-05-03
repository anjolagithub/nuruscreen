import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Remove turbopack config — it can interfere with WASM loading
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Required for SharedArrayBuffer used by MediaPipe WASM
        // Without these, MediaPipe hangs silently on mobile
        { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        { key: 'Service-Worker-Allowed',        value: '/' },
      ],
    },
    // MediaPipe CDN assets need CORP header to load under COEP
    {
      source: '/pose_landmarker_lite.task',
      headers: [
        { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
  ],
};

export default nextConfig;