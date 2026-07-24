import path from 'node:path';
import { getLocalStorageProvider } from './storage';

function localProvider() {
  return getLocalStorageProvider();
}

export async function saveFileLocal(buffer: Buffer, id: string, extension: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid storage identifier');
  if (!/^\.[a-z0-9]{1,8}$/i.test(extension)) throw new Error('Invalid storage extension');

  const key = `${id}${extension.toLowerCase()}`;
  await localProvider().save({
    key,
    data: buffer,
    contentType: 'application/octet-stream',
  });
  return path.join(localProvider().getRootForDiagnostics(), key);
}

export async function deleteFileLocal(fullPathOrKey: string): Promise<void> {
  const key = localProvider().keyFromLegacyPath(fullPathOrKey);
  await localProvider().delete(key);
}

export async function readFileLocal(fullPathOrKey: string): Promise<Buffer> {
  const key = localProvider().keyFromLegacyPath(fullPathOrKey);
  const bytes = await localProvider().read(key);
  return Buffer.from(bytes);
}

export function getLocalUploadsDir(): string {
  return localProvider().getRootForDiagnostics();
}
