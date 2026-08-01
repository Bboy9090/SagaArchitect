export function clientApiErrorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback;
  const body = value as { error?: unknown };
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  if (body.error && typeof body.error === 'object') {
    const error = body.error as { message?: unknown; requestId?: unknown };
    if (typeof error.message === 'string' && error.message.trim()) {
      return typeof error.requestId === 'string' && error.requestId ? `${error.message} Reference: ${error.requestId}` : error.message;
    }
  }
  return fallback;
}
