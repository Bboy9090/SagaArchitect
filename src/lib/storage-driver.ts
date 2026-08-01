import fs from 'fs';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || 'storage/uploads';

const uploadsDirectory = path.isAbsolute(STORAGE_PATH)
  ? STORAGE_PATH
  : path.join(process.cwd(), STORAGE_PATH);

function assertInsideUploads(candidate: string): string {
  const resolvedUploadsDir = path.resolve(uploadsDirectory);
  const resolvedPath = path.resolve(candidate);
  const relative = path.relative(resolvedUploadsDir, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied: path is outside uploads directory');
  }
  return resolvedPath;
}

async function ensureUploadsDirectory(): Promise<void> {
  await fs.promises.mkdir(uploadsDirectory, { recursive: true });
}

export async function saveFileLocal(buffer: Buffer, id: string, extension: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid storage identifier');
  if (!/^\.[a-z0-9]{1,8}$/i.test(extension)) throw new Error('Invalid storage extension');
  await ensureUploadsDirectory();
  const fullPath = assertInsideUploads(path.join(uploadsDirectory, `${id}${extension.toLowerCase()}`));
  await fs.promises.writeFile(fullPath, buffer, { flag: 'wx' });
  return fullPath;
}

export async function deleteFileLocal(fullPath: string): Promise<void> {
  const resolvedPath = assertInsideUploads(fullPath);
  try {
    await fs.promises.unlink(resolvedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function readFileLocal(fullPath: string): Promise<Buffer> {
  return fs.promises.readFile(assertInsideUploads(fullPath));
}

export function getLocalUploadsDir(): string {
  return uploadsDirectory;
}
