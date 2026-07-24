export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'CONFIGURATION_ERROR'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly expose: boolean;

  constructor(message: string, status: number, code: ApiErrorCode, expose = true) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'The request is invalid.') {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication is required.') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'You do not have access to this resource.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'The requested resource was not found.') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'The request conflicts with the current resource state.') {
    super(message, 409, 'CONFLICT');
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = 'The request payload is too large.') {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
  }
}

export class UnsupportedMediaTypeError extends ApiError {
  constructor(message = 'The request content type is not supported.') {
    super(message, 415, 'UNSUPPORTED_MEDIA_TYPE');
  }
}

export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMITED');
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

export class ConfigurationError extends ApiError {
  constructor(message = 'The service is not configured correctly.') {
    super(message, 500, 'CONFIGURATION_ERROR', false);
  }
}

export class DependencyUnavailableError extends ApiError {
  constructor(message = 'A required service is temporarily unavailable.') {
    super(message, 503, 'DEPENDENCY_UNAVAILABLE');
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'An unexpected error occurred.') {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}

interface StatusLikeError {
  status?: unknown;
  message?: unknown;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const statusLike = error as StatusLikeError;
  if (statusLike && typeof statusLike.status === 'number') {
    if (statusLike.status === 401) return new AuthenticationError();
    if (statusLike.status === 403) return new AuthorizationError();
    if (statusLike.status === 404) return new NotFoundError();
  }

  return new InternalServerError();
}
