import { ValidationError } from './api-errors';

const ETAG_VERSION = /^(?:W\/)?"?(\d+)"?$/;

export function parseVersionValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(ETAG_VERSION);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function expectedVersionFromRequest(request: Request, body: Record<string, unknown>): number {
  const bodyValue = body.expected_version ?? body.version;
  const bodyVersion = parseVersionValue(bodyValue);
  const headerValue = request.headers.get('if-match');
  const headerVersion = headerValue ? parseVersionValue(headerValue) : null;

  if (bodyValue !== undefined && bodyVersion === null) {
    throw new ValidationError('expected_version must be a positive integer.');
  }
  if (headerValue && headerVersion === null) {
    throw new ValidationError('If-Match must contain a positive integer version.');
  }
  if (bodyVersion !== null && headerVersion !== null && bodyVersion !== headerVersion) {
    throw new ValidationError('expected_version and If-Match must identify the same version.');
  }

  const expected = headerVersion ?? bodyVersion;
  if (expected === null) {
    throw new ValidationError('An expected version is required through expected_version, version, or If-Match.');
  }
  return expected;
}

export function versionEtag(version: number): string {
  const parsed = parseVersionValue(version);
  if (parsed === null) throw new ValidationError('Cannot create an ETag from an invalid version.');
  return `"${parsed}"`;
}
