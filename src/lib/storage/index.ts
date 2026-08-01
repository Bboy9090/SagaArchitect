import { ConfigurationError } from '../api-errors';
import { LocalStorageProvider } from './local-storage-provider';
import type { StorageProvider, StorageProviderName } from './storage-provider';

let localProvider: LocalStorageProvider | undefined;

export function getLocalStorageProvider(): LocalStorageProvider {
  localProvider ??= new LocalStorageProvider();
  return localProvider;
}

export function getStorageProvider(
  name: StorageProviderName = (process.env.STORAGE_PROVIDER || 'local') as StorageProviderName,
): StorageProvider {
  if (name === 'local') return getLocalStorageProvider();
  throw new ConfigurationError(
    `Storage provider "${name}" is configured but its durable adapter is not integrated yet.`,
  );
}

export function resetStorageProviderForTests(): void {
  localProvider = undefined;
}

export type { StorageProvider, StorageProviderName, StorageWriteInput, StoredObject } from './storage-provider';
