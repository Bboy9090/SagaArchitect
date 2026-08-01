import { ValidationError } from '../api-errors';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

export function validateStorageKey(key: string): string {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('\\') || key.startsWith('/')) {
    throw new ValidationError('The storage key is invalid.');
  }
  return key;
}

export function encodeStorageKey(key: string): string {
  return validateStorageKey(key).split('/').map(encodeURIComponent).join('/');
}
