export type StorageMode = 'local' | 'db';

export function getStorageMode(): StorageMode {
  if (typeof window === 'undefined') return 'local';
  const val = localStorage.getItem('phoenix_storage_mode');
  return val === 'db' ? 'db' : 'local';
}

export function setStorageMode(mode: StorageMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('phoenix_storage_mode', mode);
}

export function isDbMode(): boolean {
  return getStorageMode() === 'db';
}
