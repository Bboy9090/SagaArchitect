export interface AuthSecurityEnvironment {
  APP_ENV?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  NEXTAUTH_URL?: string;
}

export interface AuthCookiePolicy {
  secure: boolean;
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
}

export function authEnvironmentName(
  environment: AuthSecurityEnvironment = process.env,
): string {
  return (
    environment.APP_ENV
    || environment.VERCEL_ENV
    || environment.NODE_ENV
    || 'development'
  ).trim().toLowerCase();
}

export function isProductionLikeAuthEnvironment(
  environment: AuthSecurityEnvironment = process.env,
): boolean {
  return ['production', 'staging', 'preview'].includes(authEnvironmentName(environment));
}

export function authUsesSecureCookies(
  environment: AuthSecurityEnvironment = process.env,
): boolean {
  return isProductionLikeAuthEnvironment(environment);
}

export function authCookiePolicy(
  environment: AuthSecurityEnvironment = process.env,
): AuthCookiePolicy {
  return {
    secure: authUsesSecureCookies(environment),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  };
}

export function assertAuthDeploymentUrl(
  environment: AuthSecurityEnvironment = process.env,
): void {
  if (!isProductionLikeAuthEnvironment(environment)) return;

  const rawUrl = environment.NEXTAUTH_URL?.trim();
  if (!rawUrl) throw new Error('NEXTAUTH_URL is required in staging and production.');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('NEXTAUTH_URL must be a valid URL.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('NEXTAUTH_URL must use HTTPS in staging and production.');
  }
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())) {
    throw new Error('NEXTAUTH_URL must be a remote host in staging and production.');
  }
}
