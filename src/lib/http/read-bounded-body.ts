import { PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from '../api-errors';
import type { BodyLimitPolicy } from './body-limits';

interface ReadOptions {
  policy: BodyLimitPolicy;
  allowedContentTypes?: string[];
}

function mediaTypeOf(request: Request): string {
  return (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
}

function assertContentType(request: Request, allowedContentTypes?: string[]): void {
  if (!allowedContentTypes?.length) return;
  const mediaType = mediaTypeOf(request);
  if (!allowedContentTypes.some((allowed) => mediaType === allowed || mediaType.startsWith(`${allowed}+`))) {
    throw new UnsupportedMediaTypeError(`Content-Type ${mediaType || '(missing)'} is not supported.`);
  }
}

function assertDeclaredLength(request: Request, maxBytes: number): void {
  const header = request.headers.get('content-length');
  if (!header) return;
  const declaredLength = Number.parseInt(header, 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLargeError(`Payload exceeds the ${maxBytes}-byte limit.`);
  }
}

export async function readRequestBytes(request: Request, options: ReadOptions): Promise<Uint8Array> {
  assertContentType(request, options.allowedContentTypes);
  assertDeclaredLength(request, options.policy.maxBytes);

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > options.policy.maxBytes) {
        await reader.cancel('payload-too-large');
        throw new PayloadTooLargeError(`Payload exceeds the ${options.policy.maxBytes}-byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readTextBodyWithLimit(request: Request, options: ReadOptions): Promise<string> {
  const bytes = await readRequestBytes(request, options);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function readJsonBodyWithLimit<T>(request: Request, options: ReadOptions): Promise<T> {
  const text = await readTextBodyWithLimit(request, {
    ...options,
    allowedContentTypes: options.allowedContentTypes ?? ['application/json'],
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError('The request body contains malformed JSON.');
  }
}

export async function readFormDataWithLimit(request: Request, options: ReadOptions): Promise<FormData> {
  const bytes = await readRequestBytes(request, {
    ...options,
    allowedContentTypes: options.allowedContentTypes ?? ['multipart/form-data'],
  });

  try {
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const response = new Response(body, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    });
    return await response.formData();
  } catch {
    throw new ValidationError('The multipart form body is malformed.');
  }
}

export function readBase64PayloadWithLimit(value: string, options: ReadOptions): Buffer {
  const commaIndex = value.indexOf(',');
  const payload = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  const normalized = payload.replace(/\s+/g, '');

  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    throw new ValidationError('The base64 payload is malformed.');
  }

  const estimatedBytes = Math.floor((normalized.length * 3) / 4) - (normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0);
  if (estimatedBytes > options.policy.maxBytes) {
    throw new PayloadTooLargeError(`Decoded payload exceeds the ${options.policy.maxBytes}-byte limit.`);
  }

  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.byteLength > options.policy.maxBytes) {
    throw new PayloadTooLargeError(`Decoded payload exceeds the ${options.policy.maxBytes}-byte limit.`);
  }
  return decoded;
}
