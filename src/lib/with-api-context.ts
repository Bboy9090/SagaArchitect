import { apiErrorResponse } from './api-response';
import { createLogger } from './logger';
import { createRequestContext, REQUEST_ID_HEADER, type ApiRequestContext } from './request-context';

export type ApiHandler = (request: Request, context: ApiRequestContext) => Promise<Response>;

export function withApiContext(handler: ApiHandler): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const context = createRequestContext(request);
    const logger = createLogger(context);

    try {
      const response = await handler(request, context);
      response.headers.set(REQUEST_ID_HEADER, context.requestId);
      logger.info('api.request.completed', {
        status: response.status,
        durationMs: Date.now() - context.startedAt,
      });
      return response;
    } catch (error) {
      logger.error('api.request.failed', {
        durationMs: Date.now() - context.startedAt,
        error,
      });
      return apiErrorResponse(error, context.requestId);
    }
  };
}
