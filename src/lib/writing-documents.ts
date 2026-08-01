import type { WritingDocument } from './types';
import { isWritingDocumentKind, isWritingDocumentStatus } from './writing-sync';

export function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function documentExport(document: WritingDocument, markdown: boolean): string {
  const heading = markdown ? `# ${document.title}` : document.title.toUpperCase();
  return `${heading}\n\n${document.content.trim()}\n`;
}

export function safeExportName(title: string, extension: 'txt' | 'md' | 'json' | 'docx' | 'epub'): string {
  const stem = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  return `${stem}.${extension}`;
}

export function orderedWritingDocuments(documents: WritingDocument[]): WritingDocument[] {
  const sorted = [...documents].sort((a, b) => a.order - b.order);
  const byParent = new Map<string | undefined, WritingDocument[]>();
  for (const document of sorted) {
    const key = document.parent_id && documents.some(item => item.id === document.parent_id) ? document.parent_id : undefined;
    byParent.set(key, [...(byParent.get(key) || []), document]);
  }
  const result: WritingDocument[] = [];
  const visit = (parentId?: string) => {
    for (const document of byParent.get(parentId) || []) {
      result.push(document);
      visit(document.id);
    }
  };
  visit();
  return result;
}

export function compileWritingProject(title: string, documents: WritingDocument[], markdown: boolean): string {
  const lines = [markdown ? `# ${title}` : title.toUpperCase(), ''];
  for (const document of orderedWritingDocuments(documents)) {
    const depth = document.parent_id ? 3 : document.kind === 'manuscript' ? 1 : 2;
    lines.push(markdown ? `${'#'.repeat(depth)} ${document.title}` : document.title.toUpperCase());
    lines.push('', document.content.trim(), '');
  }
  return `${lines.join('\n').trim()}\n`;
}

export function createWritingBackup(project: { id: string; name: string; production_type?: string }, documents: WritingDocument[]) {
  return {
    schema: 'phoenix_creator_studio.writing_backup.v1',
    exported_at: new Date().toISOString(),
    project,
    documents: orderedWritingDocuments(documents),
  };
}

export function importWritingBackup(
  value: unknown,
  projectId: string,
  idFactory: () => string,
  now = new Date().toISOString(),
): WritingDocument[] {
  if (!value || typeof value !== 'object') throw new Error('Backup must be a JSON object.');
  const backup = value as { schema?: unknown; documents?: unknown };
  if (backup.schema !== 'phoenix_creator_studio.writing_backup.v1') throw new Error('Unsupported writing backup format.');
  if (!Array.isArray(backup.documents) || backup.documents.length > 1000) throw new Error('Backup must contain at most 1,000 documents.');
  const idMap = new Map<string, string>();
  for (const item of backup.documents) {
    if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') throw new Error('Every imported document requires an id.');
    idMap.set((item as { id: string }).id, idFactory());
  }
  const imported = backup.documents.map((item, index) => {
    const source = item as Partial<WritingDocument>;
    if (typeof source.title !== 'string' || !source.title.trim()) throw new Error('Every imported document requires a title.');
    if (typeof source.content !== 'string') throw new Error('Every imported document requires text content.');
    if (!isWritingDocumentKind(source.kind) || !isWritingDocumentStatus(source.status)) throw new Error('Backup contains an unsupported document type or status.');
    return {
      id: idMap.get(source.id || '')!, project_id: projectId,
      parent_id: source.parent_id ? idMap.get(source.parent_id) : undefined,
      title: source.title.trim().slice(0, 255), kind: source.kind, status: source.status,
      content: source.content, order: index, word_target: Number.isInteger(source.word_target) && Number(source.word_target) > 0 ? Number(source.word_target) : undefined,
      created_at: now, updated_at: now,
    };
  });
  return orderedWritingDocuments(imported).map((document, order) => ({ ...document, order }));
}
