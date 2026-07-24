import { NextResponse } from 'next/server';
import { normalizeApiError, RateLimitError } from './api-errors';
import { REQUEST_ID_HEADER } from './request-context';

export function apiSuccess<T>(data: T, requestId: string, status = 200): NextResponse {
  return NextResponse.json(
    { ok: true, data },
    { status, headers: { [REQUEST_ID_HEADER]: requestId } },
  );
}

export function apiErrorResponse(error: unknown, requestId: string): NextResponse {
  const normalized = normalizeApiError(error);
  const message = normalized.expose ? normalized.message : 'An unexpected error occurred.';
  const headers: Record<string, string> = { [REQUEST_ID_HEADER]: requestId };
  if (normalized instanceof RateLimitError) {
    headers['retry-after'] = String(normalized.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: normalized.code,
        message,
        requestId,
      },
    },
    { status: normalized.status, headers },
  );
}
