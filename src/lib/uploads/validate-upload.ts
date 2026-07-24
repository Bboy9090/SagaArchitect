import { PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from '../api-errors';
import { detectImageMime } from './file-signatures';
import { createStorageIdentity, extensionOf, sanitizeDisplayFilename, type StorageIdentity } from './storage-key';
import { IMAGE_UPLOAD_POLICY, type UploadPolicy } from './upload-policy';

const MIME_TO_EXTENSIONS: Record<string, ReadonlySet<string>> = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/webp': new Set(['.webp']),
};

export interface ValidatedUpload extends StorageIdentity {
  buffer: Buffer;
  displayName: string;
  mimeType: string;
  size: number;
}

export async function validateUpload(
  file: File,
  policy: UploadPolicy = IMAGE_UPLOAD_POLICY,
): Promise<ValidatedUpload> {
  if (!file || file.size <= 0) throw new ValidationError('The uploaded file is empty.');
  if (file.size > policy.maxBytes) {
    throw new PayloadTooLargeError(`The uploaded file exceeds the ${policy.maxBytes}-byte limit.`);
  }

  const displayName = sanitizeDisplayFilename(file.name);
  const extension = extensionOf(displayName);

  if (!policy.allowedMimeTypes.has(file.type)) {
    throw new UnsupportedMediaTypeError('Only PNG, JPEG, and WEBP images are accepted.');
  }
  if (!policy.allowedExtensions.has(extension)) {
    throw new UnsupportedMediaTypeError('The uploaded file extension is not allowed.');
  }
  if (!MIME_TO_EXTENSIONS[file.type]?.has(extension)) {
    throw new UnsupportedMediaTypeError('The file extension does not match the declared MIME type.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > policy.maxBytes) {
    throw new PayloadTooLargeError(`The uploaded file exceeds the ${policy.maxBytes}-byte limit.`);
  }

  const detectedMime = detectImageMime(buffer);
  if (!detectedMime || detectedMime !== file.type) {
    throw new UnsupportedMediaTypeError('The file signature does not match the declared image type.');
  }

  return {
    ...createStorageIdentity(displayName),
    buffer,
    displayName,
    mimeType: detectedMime,
    size: buffer.byteLength,
  };
}
