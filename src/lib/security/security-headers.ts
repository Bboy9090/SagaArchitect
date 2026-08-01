export interface SecurityHeaderOptions {
  production: boolean;
  allowedConnectOrigins?: string[];
}

export interface HeaderValue {
  key: string;
  value: string;
}

function uniqueOrigins(origins: string[] = []): string[] {
  const unique = new Set<string>();
  for (const value of origins) {
    try {
      unique.add(new URL(value).origin);
    } catch {
      // Invalid optional origins are ignored here and rejected by environment validation elsewhere.
    }
  }
  return [...unique];
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions): string {
  const connectSources = ["'self'", ...uniqueOrigins(options.allowedConnectOrigins)];
  if (!options.production) connectSources.push('http:', 'https:', 'ws:', 'wss:');

  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (!options.production) scriptSources.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (options.production) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): HeaderValue[] {
  const headers: HeaderValue[] = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(options) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ];

  if (options.production) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
  }

  return headers;
}

export function buildCorsHeaders(allowedOrigin: string | undefined, production: boolean): HeaderValue[] {
  const origin = allowedOrigin?.trim();
  if (production && !origin) return [];

  return [
    { key: 'Access-Control-Allow-Origin', value: origin || '*' },
    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, X-Request-Id, Idempotency-Key' },
    { key: 'Access-Control-Max-Age', value: '86400' },
    { key: 'Vary', value: 'Origin' },
  ];
}
