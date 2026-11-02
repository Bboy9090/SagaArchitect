import { NextResponse } from 'next/server';

function environmentName(): string {
  return (process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development').toLowerCase();
}

export function isProductionLikeGenerationEnvironment(): boolean {
  return ['production', 'staging', 'preview'].includes(environmentName());
}

function mergeHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  merged.set('cache-control', 'no-store');
  return merged;
}

export function missingAiProviderResponse(headers?: HeadersInit): NextResponse {
  if (isProductionLikeGenerationEnvironment()) {
    return NextResponse.json(
      {
        ok: false,
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        error: 'Live AI generation is unavailable because the AI provider is not configured.',
      },
      { status: 503, headers: mergeHeaders(headers) },
    );
  }

  throw new Error('missingAiProviderResponse is only for production-like environments');
}

export function mockGenerationResponse<T>(payload: T, headers?: HeadersInit): NextResponse {
  if (isProductionLikeGenerationEnvironment()) {
    return missingAiProviderResponse(headers);
  }

  const merged = mergeHeaders(headers);
  merged.set('x-phoenix-generation-mode', 'mock');
  return NextResponse.json(payload, { headers: merged });
}

export function aiProviderFailureResponse(
  reason: 'empty_response' | 'malformed_response' | 'provider_error',
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      code: 'AI_PROVIDER_FAILED',
      error: 'Live AI generation failed. No synthetic replacement was returned.',
      reason,
    },
    { status: 502, headers: mergeHeaders(headers) },
  );
}
