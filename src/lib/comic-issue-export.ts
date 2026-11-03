import type { PhoenixMediaDocument } from './media-composition';
import { renderPhoenixMediaDocument } from './media-renderer';

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
  crc32: number;
  offset: number;
}

const textEncoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipLocalHeader(entry: ZipEntry): Uint8Array {
  const name = textEncoder.encode(entry.name);
  return concat([
    u32(0x04034b50),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0x0021),
    u32(entry.crc32),
    u32(entry.bytes.length),
    u32(entry.bytes.length),
    u16(name.length),
    u16(0),
    name,
  ]);
}

function zipCentralHeader(entry: ZipEntry): Uint8Array {
  const name = textEncoder.encode(entry.name);
  return concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0x0021),
    u32(entry.crc32),
    u32(entry.bytes.length),
    u32(entry.bytes.length),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(entry.offset),
    name,
  ]);
}

function buildStoredZip(files: Array<{ name: string; bytes: Uint8Array }>): Blob {
  const entries: ZipEntry[] = [];
  const locals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const entry: ZipEntry = {
      ...file,
      crc32: crc32(file.bytes),
      offset,
    };
    const header = zipLocalHeader(entry);
    locals.push(header, entry.bytes);
    offset += header.length + entry.bytes.length;
    entries.push(entry);
  }

  const central = entries.map(zipCentralHeader);
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  ]);

  const archive = concat([...locals, ...central, end]);
  const buffer = new ArrayBuffer(archive.byteLength);
  new Uint8Array(buffer).set(archive);
  return new Blob([buffer], { type: 'application/vnd.comicbook+zip' });
}

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phoenix-comic';
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char] || char));
}

function sortedPages(pages: PhoenixMediaDocument[]): PhoenixMediaDocument[] {
  return [...pages].sort((a, b) =>
    (a.pageOrder ?? Number.MAX_SAFE_INTEGER) - (b.pageOrder ?? Number.MAX_SAFE_INTEGER)
    || a.createdAt.localeCompare(b.createdAt)
  );
}

async function pagePngBytes(page: PhoenixMediaDocument): Promise<Uint8Array> {
  const canvas = await renderPhoenixMediaDocument(page);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Failed to encode comic page PNG.')), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function createComicIssueCbz(
  pages: PhoenixMediaDocument[],
  title: string,
): Promise<Blob> {
  const ordered = sortedPages(pages);
  if (ordered.length === 0) throw new Error('Comic issue has no pages to export.');
  if (ordered.length > 250) throw new Error('Comic issue exceeds the 250-page in-browser export limit.');

  const digits = Math.max(3, String(ordered.length).length);
  const files: Array<{ name: string; bytes: Uint8Array }> = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const pageNumber = String(index + 1).padStart(digits, '0');
    files.push({
      name: `${pageNumber}.png`,
      bytes: await pagePngBytes(ordered[index]),
    });
  }

  const comicInfo = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo>
  <Title>${escapeXml(title || 'Phoenix Comic')}</Title>
  <PageCount>${ordered.length}</PageCount>
  <Format>Digital</Format>
  <Notes>Exported from Phoenix Creator Studio</Notes>
</ComicInfo>`;
  files.push({ name: 'ComicInfo.xml', bytes: textEncoder.encode(comicInfo) });

  return buildStoredZip(files);
}

export function downloadComicIssueCbz(blob: Blob, title: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(title)}.cbz`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function printComicIssueProof(
  pages: PhoenixMediaDocument[],
  title: string,
): Promise<void> {
  const ordered = sortedPages(pages);
  if (ordered.length === 0) throw new Error('Comic issue has no pages to print.');
  if (ordered.length > 250) throw new Error('Comic issue exceeds the 250-page in-browser proof limit.');

  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Browser blocked the print window. Allow pop-ups and try again.');
  printWindow.opener = null;

  try {
    printWindow.document.write('<!doctype html><html><head><title>Preparing comic proof…</title></head><body>Rendering pages…</body></html>');
    printWindow.document.close();

    const pageUrls: string[] = [];
    for (const page of ordered) {
      const canvas = await renderPhoenixMediaDocument(page);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('Failed to encode comic proof page.')), 'image/png');
      });
      pageUrls.push(URL.createObjectURL(blob));
    }

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(title || 'Phoenix Comic')} — Print Proof</title>
<style>
  @page { margin: 0; size: auto; }
  html, body { margin: 0; padding: 0; background: #111; }
  .page { break-after: page; page-break-after: always; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: white; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  img { display: block; width: 100%; height: auto; max-width: 100vw; max-height: 100vh; object-fit: contain; }
  @media print {
    html, body { background: white; }
    .page { min-height: 0; }
    img { width: 100%; max-width: none; max-height: none; }
  }
</style>
</head>
<body>
${pageUrls.map((url, index) => `<section class="page"><img src="${url}" alt="Page ${index + 1}" /></section>`).join('')}
<script>
window.addEventListener('load', () => setTimeout(() => window.print(), 100));
window.addEventListener('afterprint', () => window.close());
</script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    window.setTimeout(() => pageUrls.forEach(url => URL.revokeObjectURL(url)), 120000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
