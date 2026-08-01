import type { WritingDocument } from './types';

export function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function documentExport(document: WritingDocument, markdown: boolean): string {
  const heading = markdown ? `# ${document.title}` : document.title.toUpperCase();
  return `${heading}\n\n${document.content.trim()}\n`;
}

export function safeExportName(title: string, extension: 'txt' | 'md'): string {
  const stem = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  return `${stem}.${extension}`;
}
