import { ConfigurationError } from '../api-errors';
import { LocalStorageProvider } from './local-storage-provider';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import type { StorageProvider, StorageProviderName } from './storage-provider';

let localProvider: LocalStorageProvider | undefined;
let supabaseProvider: SupabaseStorageProvider | undefined;

export function getLocalStorageProvider(): LocalStorageProvider {
  localProvider ??= new LocalStorageProvider();
  return localProvider;
}

export function getStorageProvider(
  name: StorageProviderName = (process.env.STORAGE_PROVIDER || 'local') as StorageProviderName,
): StorageProvider {
  if (name === 'local') return getLocalStorageProvider();
  if (name === 'supabase') {
    supabaseProvider ??= new SupabaseStorageProvider({
      url: process.env.SUPABASE_URL || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      bucket: process.env.SUPABASE_STORAGE_BUCKET || '',
    });
    return supabaseProvider;
  }
  throw new ConfigurationError(
    `Storage provider "${name}" is configured but its durable adapter is not integrated yet.`,
  );
}

export function resetStorageProviderForTests(): void {
  localProvider = undefined;
  supabaseProvider = undefined;
}

export type { StorageProvider, StorageProviderName, StorageWriteInput, StoredObject } from './storage-provider';
