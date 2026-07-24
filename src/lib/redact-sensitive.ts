const REDACTED = '[REDACTED]';

const SENSITIVE_KEY = /(?:password|passwordhash|authorization|cookie|token|secret|api[-_]?key|database[-_]?url|connection[-_]?string|service[-_]?role[-_]?key|session)/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const DATABASE_URL_VALUE = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function sanitizeLogText(value: string): string {
  return value
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(BEARER_VALUE, `Bearer ${REDACTED}`)
    .replace(DATABASE_URL_VALUE, REDACTED)
    .replace(JWT_VALUE, REDACTED);
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return sanitizeLogText(value);
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogText(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactInternal(entry, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactInternal(entry, seen);
  }
  return output;
}

export function redactSensitive<T>(value: T): T {
  return redactInternal(value, new WeakSet<object>()) as T;
}

export { REDACTED };
