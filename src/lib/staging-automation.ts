import { timingSafeEqual } from 'node:crypto';

export class StagingAutomationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TEST_EMAIL = /^pcs-(?:staging|chromium|firefox|webkit)-[a-z0-9]+@example\.test$/i;

export function stagingAutomationEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.APP_ENV === 'staging'
    && environment.STAGING_CONFIRM_ISOLATED === 'true'
    && environment.ALLOW_REMOTE_TESTS === 'true';
}

export function isStagingTestEmail(email: string): boolean {
  return TEST_EMAIL.test(email.trim());
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(providedBytes, expectedBytes);
}

export function assertStagingAutomationRequest(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!stagingAutomationEnabled(environment)) {
    throw new StagingAutomationError(404, 'Not found.');
  }

  const expected = environment.STAGING_AUTOMATION_TOKEN?.trim();
  if (!expected || expected.length < 32) {
    throw new StagingAutomationError(503, 'Staging automation is not configured.');
  }

  const provided = bearerToken(request);
  if (!provided || !tokensMatch(provided, expected)) {
    throw new StagingAutomationError(401, 'Unauthorized.');
  }
}
