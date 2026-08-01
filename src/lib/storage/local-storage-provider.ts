import fs from 'node:fs';
import path from 'node:path';
import { ValidationError } from '../api-errors';
import type { StorageProvider, StorageWriteInput, StoredObject } from './storage-provider';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private readonly root: string;

  constructor(rootPath = process.env.STORAGE_PATH || 'storage/uploads') {
    this.root = path.resolve(path.isAbsolute(rootPath) ? rootPath : path.join(process.cwd(), rootPath));
  }

  private resolveKey(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('\\') || path.isAbsolute(key)) {
      throw new ValidationError('The storage key is invalid.');
    }
    const resolved = path.resolve(this.root, key);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new ValidationError('The storage key escapes the configured storage root.');
    }
    return resolved;
  }

  async save(input: StorageWriteInput): Promise<StoredObject> {
    const destination = this.resolveKey(input.key);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, input.data, { flag: 'wx' });
    return { key: input.key, size: input.data.byteLength, contentType: input.contentType };
  }

  async read(key: string): Promise<Uint8Array> {
    return fs.promises.readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolveKey(key), fs.constants.F_OK);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async probe(): Promise<{ ok: boolean; provider: 'local' }> {
    await fs.promises.mkdir(this.root, { recursive: true });
    await fs.promises.access(this.root, fs.constants.R_OK | fs.constants.W_OK);
    return { ok: true, provider: this.name };
  }

  keyFromLegacyPath(value: string): string {
    const absolute = path.resolve(value);
    const relative = path.relative(this.root, absolute);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replaceAll(path.sep, '/');
    return value;
  }

  getRootForDiagnostics(): string {
    return this.root;
  }
}
