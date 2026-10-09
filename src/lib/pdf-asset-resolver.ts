import { readAssetObject } from './storage/asset-storage';
import type { StorageProviderName } from './storage/storage-provider';

export async function resolveStoredAssetToDataUrl(input: {
  storageProvider: StorageProviderName;
  storageReference: string;
  mimeType: string;
}): Promise<string> {
  const bytes = await readAssetObject(input.storageProvider, input.storageReference);
  const base64 = Buffer.from(bytes).toString('base64');
  return `data:${input.mimeType};base64,${base64}`;
}
