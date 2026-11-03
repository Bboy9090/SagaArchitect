import { PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from '../api-errors';
import { detectUploadMime } from './file-signatures';
import { createStorageIdentity, extensionOf, sanitizeDisplayFilename, type StorageIdentity } from './storage-key';
import { uploadPolicyForMime, type UploadPolicy } from './upload-policy';

const MIME_TO_EXTENSIONS: Record<string, ReadonlySet<string>> = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/webp': new Set(['.webp']),
  'video/mp4': new Set(['.mp4']),
  'video/webm': new Set(['.webm']),
  'audio/wav': new Set(['.wav']),
  'audio/mpeg': new Set(['.mp3']),
};

export interface ValidatedUpload extends StorageIdentity {
  buffer: Buffer;
  displayName: string;
  mimeType: string;
  size: number;
}

export async function validateUpload(
  file: File,
  policy?: UploadPolicy,
): Promise<ValidatedUpload> {
  if (!file || file.size <= 0) throw new ValidationError('The uploaded file is empty.');
  const selectedPolicy = policy ?? uploadPolicyForMime(file.type);
  if (file.size > selectedPolicy.maxBytes) {
    throw new PayloadTooLargeError(`The uploaded file exceeds the ${selectedPolicy.maxBytes}-byte limit.`);
  }

  const displayName = sanitizeDisplayFilename(file.name);
  const extension = extensionOf(displayName);

  if (!selectedPolicy.allowedMimeTypes.has(file.type)) {
    throw new UnsupportedMediaTypeError('This image, video, or audio media type is not accepted.');
  }
  if (!selectedPolicy.allowedExtensions.has(extension)) {
    throw new UnsupportedMediaTypeError('The uploaded file extension is not allowed.');
  }
  if (!MIME_TO_EXTENSIONS[file.type]?.has(extension)) {
    throw new UnsupportedMediaTypeError('The file extension does not match the declared MIME type.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > selectedPolicy.maxBytes) {
    throw new PayloadTooLargeError(`The uploaded file exceeds the ${selectedPolicy.maxBytes}-byte limit.`);
  }

  const detectedMime = detectUploadMime(buffer);
  if (!detectedMime || detectedMime !== file.type) {
    throw new UnsupportedMediaTypeError('The file signature does not match the declared media type.');
  }

  return {
    ...createStorageIdentity(displayName),
    buffer,
    displayName,
    mimeType: detectedMime,
    size: buffer.byteLength,
  };
}
