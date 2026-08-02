import { ConfigurationError } from '../api-errors';
import { getLocalStorageProvider, getStorageProvider } from './index';
import type { StorageProviderName } from './storage-provider';

const SAFE_EXTENSION = /^\.[a-z0-9]{1,8}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StoredAssetReference {
  storageProvider: StorageProviderName;
  storageReference: string;
  size: number;
  contentType: string;
}

export function createAssetStorageKey(assetId: string, extension: string): string {
  if (!UUID.test(assetId)) throw new ConfigurationError('Asset storage requires a valid UUID.');
  if (!SAFE_EXTENSION.test(extension)) throw new ConfigurationError('Asset storage extension is invalid.');
  return `assets/${assetId}${extension.toLowerCase()}`;
}

function storageKey(provider: StorageProviderName, reference: string): string {
  if (provider === 'local') return getLocalStorageProvider().keyFromLegacyPath(reference);
  return reference;
}

export async function saveAssetObject(input: {
  assetId: string;
  extension: string;
  data: Uint8Array;
  contentType: string;
  provider?: StorageProviderName;
}): Promise<StoredAssetReference> {
  const provider = getStorageProvider(input.provider);
  const key = createAssetStorageKey(input.assetId, input.extension);
  const stored = await provider.save({
    key,
    data: input.data,
    contentType: input.contentType,
    cacheControl: '300',
  });
  return {
    storageProvider: provider.name,
    storageReference: stored.key,
    size: stored.size,
    contentType: stored.contentType ?? input.contentType,
  };
}

export async function readAssetObject(
  providerName: StorageProviderName,
  reference: string,
): Promise<Uint8Array> {
  const provider = getStorageProvider(providerName);
  return provider.read(storageKey(providerName, reference));
}

export async function deleteAssetObject(
  providerName: StorageProviderName,
  reference: string,
): Promise<void> {
  const provider = getStorageProvider(providerName);
  await provider.delete(storageKey(providerName, reference));
}

export async function assetObjectExists(
  providerName: StorageProviderName,
  reference: string,
): Promise<boolean> {
  const provider = getStorageProvider(providerName);
  return provider.exists(storageKey(providerName, reference));
}
