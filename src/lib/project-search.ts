import type { WritingDocument } from './types';

export interface ProjectSearchOptions { case_sensitive?: boolean; whole_word?: boolean }
export interface ProjectSearchResult { document_id: string; title: string; matches: number; preview: string }

function pattern(query: string, options: ProjectSearchOptions): RegExp | undefined {
  const bounded = query.trim().slice(0, 200);
  if (!bounded) return undefined;
  const escaped = bounded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = options.whole_word ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  return new RegExp(source, `${options.case_sensitive ? '' : 'i'}gu`);
}

export function searchWritingDocuments(documents: WritingDocument[], query: string, options: ProjectSearchOptions = {}): ProjectSearchResult[] {
  const matcher = pattern(query, options);
  if (!matcher) return [];
  return documents.flatMap(document => {
    const matches = [...document.content.matchAll(matcher)];
    if (!matches.length) return [];
    const index = matches[0].index ?? 0;
    const start = Math.max(0, index - 45);
    const end = Math.min(document.content.length, index + matches[0][0].length + 75);
    return [{ document_id: document.id, title: document.title, matches: matches.length, preview: `${start ? '…' : ''}${document.content.slice(start, end).replace(/\s+/g, ' ')}${end < document.content.length ? '…' : ''}` }];
  });
}

export function replaceInWritingDocuments(documents: WritingDocument[], query: string, replacement: string, selectedIds: ReadonlySet<string>, options: ProjectSearchOptions = {}): { documents: WritingDocument[]; replacements: number } {
  const matcher = pattern(query, options);
  if (!matcher || replacement.length > 5000) return { documents, replacements: 0 };
  let replacements = 0;
  const updated = documents.map(document => {
    if (!selectedIds.has(document.id)) return document;
    const content = document.content.replace(matcher, () => { replacements += 1; return replacement; });
    return content === document.content ? document : { ...document, content, updated_at: new Date().toISOString() };
  });
  return { documents: updated, replacements };
}
