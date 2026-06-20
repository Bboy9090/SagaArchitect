import fs from 'fs';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || 'storage/uploads';

const uploadsDirectory = path.isAbsolute(STORAGE_PATH)
  ? STORAGE_PATH
  : path.join(process.cwd(), STORAGE_PATH);

// Ensure the directory exists
try {
  if (!fs.existsSync(uploadsDirectory)) {
    fs.mkdirSync(uploadsDirectory, { recursive: true });
  }
} catch (error) {
  console.error('Failed to create storage directory:', error);
}

export async function saveFileLocal(buffer: Buffer, id: string, extension: string): Promise<string> {
  const safeFilename = `${id}${extension}`;
  const fullPath = path.join(uploadsDirectory, safeFilename);
  await fs.promises.writeFile(fullPath, buffer);
  return fullPath;
}

export async function deleteFileLocal(fullPath: string): Promise<void> {
  // Validate path is indeed inside uploadsDirectory to prevent path traversal
  const resolvedPath = path.resolve(fullPath);
  const resolvedUploadsDir = path.resolve(uploadsDirectory);
  if (!resolvedPath.startsWith(resolvedUploadsDir)) {
    throw new Error('Access denied: path is outside uploads directory');
  }

  if (fs.existsSync(fullPath)) {
    await fs.promises.unlink(fullPath);
  }
}

export async function readFileLocal(fullPath: string): Promise<Buffer> {
  // Validate path is indeed inside uploadsDirectory to prevent path traversal
  const resolvedPath = path.resolve(fullPath);
  const resolvedUploadsDir = path.resolve(uploadsDirectory);
  if (!resolvedPath.startsWith(resolvedUploadsDir)) {
    throw new Error('Access denied: path is outside uploads directory');
  }

  return fs.promises.readFile(fullPath);
}

export function getLocalUploadsDir(): string {
  return uploadsDirectory;
}
