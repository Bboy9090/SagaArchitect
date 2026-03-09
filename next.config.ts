import type { NextConfig } from "next";

/**
 * LoreEngine API CORS configuration
 *
 * Rainstorms (and any future tool) runs on a different origin from SagaArchitect.
 * Without CORS headers every cross-origin API request is blocked by the browser.
 *
 * In development (RAINSTORMS_BASE_URL not set) the wildcard '*' is used so any
 * local port can reach the API without configuration.
 *
 * In production, set RAINSTORMS_BASE_URL to the exact origin of your Rainstorms
 * deployment (e.g. https://your-rainstorms-app.vercel.app). That value is used
 * as the Access-Control-Allow-Origin header, restricting cross-origin access to
 * only your Rainstorms instance.
 *
 * Multiple origins: if you need to allow more than one origin, list them
 * space-separated in RAINSTORMS_BASE_URL or handle it in individual route
 * handlers by reflecting the Origin header when it matches an allowlist.
 *
 * See docs/deployment.md for full deployment and CORS configuration guidance.
 */

// Use the Rainstorms base URL as the allowed CORS origin when set.
// Fall back to wildcard for local development convenience.
// An empty or whitespace-only value is treated the same as unset (wildcard).
const rawRainstormsUrl = process.env.RAINSTORMS_BASE_URL?.trim() ?? '';
const allowedOrigin = rawRainstormsUrl.length > 0 ? rawRainstormsUrl : '*';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply CORS to all LoreEngine API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
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
