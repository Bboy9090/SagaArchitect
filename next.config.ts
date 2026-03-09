import type { NextConfig } from "next";

/**
 * LoreEngine API CORS configuration
 *
 * Rainstorms (and any future tool) runs on a different origin from SagaArchitect.
 * Without CORS headers every cross-origin API request is blocked by the browser.
 *
 * To restrict to specific origins in production, replace the wildcard with:
 *   'https://your-rainstorms-domain.vercel.app'
 *
 * Multiple origins can be supported by reading the request Origin header
 * in individual route handlers and reflecting it back if it's in an allowlist.
 * For the MVP we use the wildcard — tighten this in production.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply CORS to all LoreEngine API routes
        source: '/api/:path*',
        headers: [
          // Allow any origin — tighten to specific Rainstorms domain in production
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          // Cache preflight result for 24 hours to reduce latency
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
