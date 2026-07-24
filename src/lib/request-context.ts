export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export interface ApiRequestContext {
  requestId: string;
  startedAt: number;
  route: string;
  method: string;
  userId?: string;
}

export function createRequestContext(request: Request): ApiRequestContext {
  const supplied = request.headers.get(REQUEST_ID_HEADER)?.trim();
  const requestId = supplied && VALID_REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID();
  const url = new URL(request.url);
  return {
    requestId,
    startedAt: Date.now(),
    route: url.pathname,
    method: request.method,
  };
}
