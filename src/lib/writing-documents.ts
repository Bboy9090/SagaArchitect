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
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (parentId?: string) => {
    for (const document of byParent.get(parentId) || []) {
      if (visited.has(document.id) || visiting.has(document.id)) continue;
      visiting.add(document.id);
      result.push(document);
      visit(document.id);
      visiting.delete(document.id);
      visited.add(document.id);
    }
  };
  visit();
  for (const document of sorted) {
    if (!visited.has(document.id)) {
      result.push({ ...document, parent_id: undefined });
      visited.add(document.id);
    }
  }
  return result;
}

export function moveWritingDocument(documents: WritingDocument[], documentId: string, direction: -1 | 1): WritingDocument[] {
  const selected = documents.find(document => document.id === documentId);
  if (!selected) return orderedWritingDocuments(documents).map((document, order) => ({ ...document, order }));
  const siblings = documents.filter(document => document.parent_id === selected.parent_id).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex(document => document.id === documentId);
  const target = siblings[index + direction];
  if (!target) return orderedWritingDocuments(documents).map((document, order) => ({ ...document, order }));
  const moved = documents.map(document => document.id === selected.id ? { ...document, order: target.order } : document.id === target.id ? { ...document, order: selected.order } : document);
  return orderedWritingDocuments(moved).map((document, order) => ({ ...document, order }));
}

export function reparentWritingScene(documents: WritingDocument[], sceneId: string, chapterId?: string): WritingDocument[] {
  const scene = documents.find(document => document.id === sceneId);
  if (!scene || scene.kind !== 'scene') throw new Error('Only scenes can be assigned to chapters.');
  if (chapterId) {
    const chapter = documents.find(document => document.id === chapterId);
    if (!chapter || chapter.kind !== 'chapter') throw new Error('Scenes can only be assigned to an existing chapter.');
  }
  const moved = documents.map(document => document.id === sceneId ? { ...document, parent_id: chapterId, order: documents.length } : document);
  return orderedWritingDocuments(moved).map((document, order) => ({ ...document, order }));
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
