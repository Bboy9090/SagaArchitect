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


export const AV_UPLOAD_POLICY: UploadPolicy = {
  maxBytes: 64 * 1024 * 1024,
  allowedMimeTypes: new Set([
    'video/mp4',
    'video/webm',
    'audio/wav',
    'audio/mpeg',
  ]),
  allowedExtensions: new Set(['.mp4', '.webm', '.wav', '.mp3']),
};

export function uploadPolicyForMime(mimeType: string): UploadPolicy {
  return mimeType.startsWith('image/') ? IMAGE_UPLOAD_POLICY : AV_UPLOAD_POLICY;
}
