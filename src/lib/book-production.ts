import { orderedWritingDocuments } from './writing-documents';
import type { PublishingMetadata, WritingDocument } from './types';

export type BookTrimPresetId = 'trade_6x9' | 'digest_5x8' | 'square_8_5' | 'letter';

export interface BookTrimPreset {
  id: BookTrimPresetId;
  label: string;
  widthIn: number;
  heightIn: number;
  description: string;
}

export interface BookLayoutSettings {
  trimPreset: BookTrimPresetId;
  bleedIn: number;
  topMarginIn: number;
  bottomMarginIn: number;
  outsideMarginIn: number;
  gutterIn: number;
  fontSizePt: number;
  lineHeight: number;
}

export const BOOK_TRIM_PRESETS: readonly BookTrimPreset[] = [
  { id: 'trade_6x9', label: 'Trade 6 × 9 in', widthIn: 6, heightIn: 9, description: 'Common paperback novel and nonfiction trim.' },
  { id: 'digest_5x8', label: 'Digest 5 × 8 in', widthIn: 5, heightIn: 8, description: 'Compact fiction, memoir, and portable reading.' },
  { id: 'square_8_5', label: 'Square 8.5 × 8.5 in', widthIn: 8.5, heightIn: 8.5, description: 'Illustrated and children’s book layout.' },
  { id: 'letter', label: 'US Letter 8.5 × 11 in', widthIn: 8.5, heightIn: 11, description: 'Workbooks, manuals, and review copies.' },
] as const;

export const DEFAULT_BOOK_LAYOUT: BookLayoutSettings = {
  trimPreset: 'trade_6x9',
  bleedIn: 0.125,
  topMarginIn: 0.75,
  bottomMarginIn: 0.75,
  outsideMarginIn: 0.625,
  gutterIn: 0.875,
  fontSizePt: 11,
  lineHeight: 1.45,
};

const STORAGE_PREFIX = 'phoenix_book_layout:';

export function loadBookLayoutSettings(projectId: string): BookLayoutSettings {
  if (typeof window === 'undefined') return DEFAULT_BOOK_LAYOUT;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return DEFAULT_BOOK_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<BookLayoutSettings>;
    return { ...DEFAULT_BOOK_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_BOOK_LAYOUT;
  }
}

export function saveBookLayoutSettings(projectId: string, settings: BookLayoutSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(settings));
}

export function bookTrimPreset(id: BookTrimPresetId): BookTrimPreset {
  return BOOK_TRIM_PRESETS.find(preset => preset.id === id) || BOOK_TRIM_PRESETS[0];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function paragraphHtml(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/u)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function buildBookPrintHtml(
  title: string,
  documents: WritingDocument[],
  metadata: PublishingMetadata,
  settings: BookLayoutSettings,
): string {
  const trim = bookTrimPreset(settings.trimPreset);
  const ordered = orderedWritingDocuments(documents).filter(document => document.kind !== 'notes');
  const body = ordered.map(document => {
    const frontMatter = ['title_page','copyright','dedication','epigraph','foreword','preface'].includes(document.kind);
    const heading = document.kind === 'title_page'
      ? `<h1 class="book-title">${escapeHtml(document.title || title)}</h1>`
      : `<h2>${escapeHtml(document.title)}</h2>`;
    return `<section class="${frontMatter ? 'front-matter' : 'book-section'}">${heading}${paragraphHtml(document.content)}</section>`;
  }).join('');

  const author = metadata.author?.trim() ? `<div class="author">${escapeHtml(metadata.author)}</div>` : '';
  const isbn = metadata.isbn?.trim() ? `<div class="meta">ISBN ${escapeHtml(metadata.isbn)}</div>` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)} — Print Layout</title>
<style>
@page { size: ${trim.widthIn}in ${trim.heightIn}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ddd; color: #111; }
body { font-family: Georgia, "Times New Roman", serif; }
.print-note { margin: 16px auto; max-width: 760px; padding: 12px 16px; background: #fff7d6; font: 13px/1.4 system-ui, sans-serif; }
.manuscript { margin: 0 auto; background: white; width: ${trim.widthIn}in; min-height: ${trim.heightIn}in; }
section {
  page-break-before: always;
  min-height: ${trim.heightIn}in;
  padding-top: ${settings.topMarginIn}in;
  padding-bottom: ${settings.bottomMarginIn}in;
  padding-left: ${settings.gutterIn}in;
  padding-right: ${settings.outsideMarginIn}in;
}
section:nth-of-type(even) {
  padding-left: ${settings.outsideMarginIn}in;
  padding-right: ${settings.gutterIn}in;
}
section:first-child { page-break-before: auto; }
h1, h2 { page-break-after: avoid; text-align: center; }
h2 { margin: 1.2in 0 0.6in; font-size: 18pt; }
.book-title { margin-top: 2.1in; font-size: 28pt; }
.author, .meta { text-align: center; margin-top: 0.35in; }
p {
  font-size: ${settings.fontSizePt}pt;
  line-height: ${settings.lineHeight};
  margin: 0 0 0.12in;
  orphans: 3;
  widows: 3;
  text-indent: 0.22in;
  text-align: justify;
}
.front-matter p { text-indent: 0; text-align: center; }
@media print {
  html, body { background: white; }
  .print-note { display: none; }
  .manuscript { margin: 0; }
}
</style>
</head>
<body>
<div class="print-note">
  Phoenix print-layout preview: trim ${trim.widthIn} × ${trim.heightIn} in, gutter ${settings.gutterIn} in,
  outside margin ${settings.outsideMarginIn} in, bleed target ${settings.bleedIn} in. Use the browser Print dialog and choose Save as PDF.
  This browser-generated PDF is a layout proof; commercial printer preflight requirements still apply.
</div>
<main class="manuscript">
<section class="front-matter">
  <h1 class="book-title">${escapeHtml(title)}</h1>
  ${author}
  ${isbn}
</section>
${body}
</main>
</body>
</html>`;
}
