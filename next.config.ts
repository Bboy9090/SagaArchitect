import type { NextConfig } from 'next';
import { buildCorsHeaders, buildSecurityHeaders } from './src/lib/security/security-headers';

const rawRainstormsUrl = process.env.RAINSTORMS_BASE_URL?.trim() || undefined;
const appEnvironment = (process.env.APP_ENV || process.env.VERCEL_ENV || 'development').toLowerCase();
const production = appEnvironment === 'production' || appEnvironment === 'staging' || appEnvironment === 'preview';

const connectOrigins = [process.env.SUPABASE_URL, rawRainstormsUrl].filter((value): value is string => Boolean(value));
const securityHeaders = buildSecurityHeaders({ production, allowedConnectOrigins: connectOrigins });
const corsHeaders = buildCorsHeaders(rawRainstormsUrl, production);

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...(corsHeaders.length > 0
        ? [
            {
              source: '/api/:path*',
              headers: corsHeaders,
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
