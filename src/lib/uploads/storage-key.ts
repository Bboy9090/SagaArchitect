import { ValidationError } from '../api-errors';

const CONTROL_OR_NULL = /[\u0000-\u001f\u007f]/;
const PATH_MARKERS = /(?:^|[\\/])\.\.(?:[\\/]|$)|[\\/]/;

export interface StorageIdentity {
  id: string;
  extension: string;
  key: string;
}

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index).toLowerCase() : '';
}

export function sanitizeDisplayFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed || CONTROL_OR_NULL.test(trimmed) || PATH_MARKERS.test(trimmed)) {
    throw new ValidationError('The uploaded filename is invalid.');
  }

  return trimmed.replace(/[^A-Za-z0-9._() -]/g, '_').replace(/\s+/g, ' ').slice(0, 180);
}

export function createStorageIdentity(filename: string): StorageIdentity {
  const safeName = sanitizeDisplayFilename(filename);
  const extension = extensionOf(safeName);
  const id = crypto.randomUUID();
  return { id, extension, key: `${id}${extension}` };
}
