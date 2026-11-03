export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export function detectImageMime(buffer: Uint8Array): SupportedImageMime | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 12 &&
    String.fromCharCode(...buffer.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...buffer.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}


export type SupportedAvMime = 'video/mp4' | 'video/webm' | 'audio/wav' | 'audio/mpeg';
export type SupportedUploadMime = SupportedImageMime | SupportedAvMime;

function ascii(buffer: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buffer.slice(start, end));
}

export function detectAvMime(buffer: Uint8Array): SupportedAvMime | null {
  if (buffer.length >= 12 && ascii(buffer, 4, 8) === 'ftyp') return 'video/mp4';

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }

  if (
    buffer.length >= 12 &&
    ascii(buffer, 0, 4) === 'RIFF' &&
    ascii(buffer, 8, 12) === 'WAVE'
  ) {
    return 'audio/wav';
  }

  if (buffer.length >= 3 && ascii(buffer, 0, 3) === 'ID3') return 'audio/mpeg';
  if (
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    (buffer[1] & 0xe0) === 0xe0
  ) {
    return 'audio/mpeg';
  }

  return null;
}

export function detectUploadMime(buffer: Uint8Array): SupportedUploadMime | null {
  return detectImageMime(buffer) || detectAvMime(buffer);
}
