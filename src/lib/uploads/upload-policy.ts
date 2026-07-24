export interface UploadPolicy {
  maxBytes: number;
  allowedMimeTypes: ReadonlySet<string>;
  allowedExtensions: ReadonlySet<string>;
}

export const IMAGE_UPLOAD_POLICY: UploadPolicy = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/webp']),
  allowedExtensions: new Set(['.png', '.jpg', '.jpeg', '.webp']),
};
