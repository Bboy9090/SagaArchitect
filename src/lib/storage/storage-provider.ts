export type StorageProviderName = 'local' | 'supabase' | 's3';

export interface StorageWriteInput {
  key: string;
  data: Uint8Array;
  contentType: string;
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType?: string;
}

export interface StorageProvider {
  readonly name: StorageProviderName;
  save(input: StorageWriteInput): Promise<StoredObject>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  probe(): Promise<{ ok: boolean; provider: StorageProviderName }>;
}
