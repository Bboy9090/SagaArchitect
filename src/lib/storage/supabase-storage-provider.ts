import { ConfigurationError, DependencyUnavailableError } from '../api-errors';
import { encodeStorageKey } from './storage-key';
import type { StorageProvider, StorageWriteInput, StoredObject } from './storage-provider';

type FetchImplementation = typeof fetch;

export interface SupabaseStorageOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  fetchImpl?: FetchImplementation;
}

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ConfigurationError(`${name} is required for Supabase storage.`);
  return normalized;
}

export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase' as const;
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;
  private readonly fetchImpl: FetchImplementation;

  constructor(options: SupabaseStorageOptions) {
    const url = required(options.url, 'SUPABASE_URL');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ConfigurationError('SUPABASE_URL must be a valid HTTPS URL.');
    }
    if (parsed.protocol !== 'https:') throw new ConfigurationError('SUPABASE_URL must use HTTPS.');
    this.baseUrl = parsed.toString().replace(/\/$/, '');
    this.serviceRoleKey = required(options.serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = required(options.bucket, 'SUPABASE_STORAGE_BUCKET');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(extra: HeadersInit = {}): Headers {
    const headers = new Headers(extra);
    headers.set('apikey', this.serviceRoleKey);
    headers.set('authorization', `Bearer ${this.serviceRoleKey}`);
    return headers;
  }

  private objectUrl(key: string): string {
    return `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodeStorageKey(key)}`;
  }

  private async requireSuccess(response: Response, operation: string): Promise<void> {
    if (!response.ok) {
      throw new DependencyUnavailableError(`Supabase storage ${operation} failed with status ${response.status}.`);
    }
  }

  async save(input: StorageWriteInput): Promise<StoredObject> {
    const response = await this.fetchImpl(this.objectUrl(input.key), {
      method: 'POST',
      headers: this.headers({
        'content-type': input.contentType,
        'cache-control': input.cacheControl ?? '3600',
        'x-upsert': 'false',
      }),
      body: input.data.buffer.slice(
        input.data.byteOffset,
        input.data.byteOffset + input.data.byteLength,
      ) as ArrayBuffer,
    });
    await this.requireSuccess(response, 'write');
    return { key: input.key, size: input.data.byteLength, contentType: input.contentType };
  }

  async read(key: string): Promise<Uint8Array> {
    const response = await this.fetchImpl(this.objectUrl(key), { headers: this.headers() });
    await this.requireSuccess(response, 'read');
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const response = await this.fetchImpl(this.objectUrl(key), { method: 'DELETE', headers: this.headers() });
    if (response.status === 404) return;
    await this.requireSuccess(response, 'delete');
  }

  async exists(key: string): Promise<boolean> {
    const response = await this.fetchImpl(this.objectUrl(key), {
      headers: this.headers({ range: 'bytes=0-0' }),
    });
    if (response.status === 404) return false;
    await this.requireSuccess(response, 'existence check');
    return true;
  }

  async probe(): Promise<{ ok: boolean; provider: 'supabase' }> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/storage/v1/bucket/${encodeURIComponent(this.bucket)}`,
      { headers: this.headers() },
    );
    await this.requireSuccess(response, 'probe');
    return { ok: true, provider: this.name };
  }
}
