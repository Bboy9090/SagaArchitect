import { redactSensitive, sanitizeLogText } from './redact-sensitive';
import type { ApiRequestContext } from './request-context';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function shouldLog(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel;
  const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  return order[level] >= order[configured];
}

function emit(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  if (!shouldLog(level)) return;
  const payload = redactSensitive({
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeLogText(message),
    ...fields,
  });
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function createLogger(context?: Partial<ApiRequestContext>) {
  const base = context
    ? {
        requestId: context.requestId,
        route: context.route,
        method: context.method,
        userId: context.userId,
      }
    : {};

  return {
    debug: (message: string, fields?: Record<string, unknown>) => emit('debug', message, { ...base, ...fields }),
    info: (message: string, fields?: Record<string, unknown>) => emit('info', message, { ...base, ...fields }),
    warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, { ...base, ...fields }),
    error: (message: string, fields?: Record<string, unknown>) => emit('error', message, { ...base, ...fields }),
  };
}
