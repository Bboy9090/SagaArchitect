export const WRITING_DOCUMENT_KINDS = ['manuscript', 'chapter', 'scene', 'screenplay', 'comic_script', 'notes'] as const;
export const WRITING_DOCUMENT_STATUSES = ['outline', 'draft', 'revision', 'final'] as const;

export interface DocumentParentRecord { id: string; parentId?: string | null }

export function collectDocumentDescendantIds(documents: DocumentParentRecord[], rootId: string): string[] {
  const descendants = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const document of documents) {
      if (document.parentId && descendants.has(document.parentId) && !descendants.has(document.id)) {
        descendants.add(document.id);
        changed = true;
      }
    }
  }
  return [...descendants];
}

export function isWritingDocumentKind(value: unknown): value is typeof WRITING_DOCUMENT_KINDS[number] {
  return typeof value === 'string' && (WRITING_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isWritingDocumentStatus(value: unknown): value is typeof WRITING_DOCUMENT_STATUSES[number] {
  return typeof value === 'string' && (WRITING_DOCUMENT_STATUSES as readonly string[]).includes(value);
}
