export class OutlineValidationError extends Error {
  constructor(public status: 400 | 409, message: string) { super(message); }
}

export interface ExistingOutlineDocument { id: string; kind: string; version: number }
export interface ValidatedOutlineChange { id: string; parentId: string | null; order: number; version: number }

export function validateWritingOutlineChanges(existing: ExistingOutlineDocument[], payload: unknown): ValidatedOutlineChange[] {
  if (!Array.isArray(payload) || payload.length > 1000) throw new OutlineValidationError(400, 'Outline must contain at most 1,000 documents.');
  if (payload.length !== existing.length) throw new OutlineValidationError(409, 'Outline must include every current project document.');
  const byId = new Map(existing.map(document => [document.id, document]));
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  return payload.map(value => {
    if (!value || typeof value !== 'object') throw new OutlineValidationError(400, 'Every outline entry must be an object.');
    const entry = value as { id?: unknown; parent_id?: unknown; order?: unknown; version?: unknown };
    if (typeof entry.id !== 'string' || seenIds.has(entry.id)) throw new OutlineValidationError(400, 'Outline document IDs must be unique.');
    const document = byId.get(entry.id);
    if (!document) throw new OutlineValidationError(409, 'Outline contains an unknown project document.');
    if (!Number.isInteger(entry.order) || Number(entry.order) < 0 || Number(entry.order) >= existing.length || seenOrders.has(Number(entry.order))) throw new OutlineValidationError(400, 'Outline order must be unique and contiguous.');
    if (entry.version !== document.version) throw new OutlineValidationError(409, 'This outline changed on another device. Reload it before saving.');
    const parentId = typeof entry.parent_id === 'string' && entry.parent_id ? entry.parent_id : null;
    if (parentId) {
      const parent = byId.get(parentId);
      if (document.kind !== 'scene' || !parent || parent.kind !== 'chapter') throw new OutlineValidationError(400, 'Only scenes may be nested beneath chapters.');
    }
    seenIds.add(entry.id); seenOrders.add(Number(entry.order));
    return { id: entry.id, parentId, order: Number(entry.order), version: document.version };
  });
}
