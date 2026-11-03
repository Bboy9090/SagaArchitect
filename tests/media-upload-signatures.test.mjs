import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAvMime, detectUploadMime } from '../src/lib/uploads/file-signatures.ts';

const bytes = (...values) => new Uint8Array(values);
const ascii = (text) => new TextEncoder().encode(text);

function concat(...parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

test('detects MP4 ISO-BMFF signature', () => {
  const sample = concat(bytes(0,0,0,24), ascii('ftyp'), ascii('isom'), bytes(0,0,0,0), ascii('isom'));
  assert.equal(detectAvMime(sample), 'video/mp4');
});

test('detects WebM EBML signature', () => {
  assert.equal(detectAvMime(bytes(0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81)), 'video/webm');
});

test('detects WAV RIFF/WAVE signature', () => {
  const sample = concat(ascii('RIFF'), bytes(0,0,0,0), ascii('WAVE'), ascii('fmt '));
  assert.equal(detectAvMime(sample), 'audio/wav');
});

test('detects MP3 ID3 and frame-sync signatures', () => {
  assert.equal(detectAvMime(concat(ascii('ID3'), bytes(4,0,0,0))), 'audio/mpeg');
  assert.equal(detectAvMime(bytes(0xff,0xfb,0x90,0x64)), 'audio/mpeg');
});

test('rejects unrelated and truncated bytes', () => {
  assert.equal(detectAvMime(ascii('not-media')), null);
  assert.equal(detectUploadMime(bytes(0xff)), null);
});
