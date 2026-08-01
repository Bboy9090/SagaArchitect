import type { PublishingMetadata } from './types';

const LIMITS: Record<keyof PublishingMetadata, number> = {
  author: 255,
  publisher: 255,
  language: 35,
  isbn: 32,
  description: 4000,
  rights: 1000,
};

export const EMPTY_PUBLISHING_METADATA: PublishingMetadata = {
  author: '', publisher: '', language: 'en', isbn: '', description: '', rights: '',
};

export function normalizePublishingMetadata(value: unknown): PublishingMetadata {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const metadata: PublishingMetadata = {};
  for (const key of Object.keys(LIMITS) as Array<keyof PublishingMetadata>) {
    const field = source[key];
    metadata[key] = typeof field === 'string' ? field.trim().slice(0, LIMITS[key]) : '';
  }
  return metadata;
}

export function normalizedIsbn(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn(value: string): boolean {
  const isbn = normalizedIsbn(value);
  if (!isbn) return true;
  if (/^\d{9}[\dX]$/.test(isbn)) {
    return [...isbn].reduce((sum, character, index) => sum + (character === 'X' ? 10 : Number(character)) * (10 - index), 0) % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    return [...isbn].reduce((sum, character, index) => sum + Number(character) * (index % 2 === 0 ? 1 : 3), 0) % 10 === 0;
  }
  return false;
}
