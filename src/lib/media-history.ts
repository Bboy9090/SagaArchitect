import type { PhoenixMediaDocument } from './media-composition';

export interface PhoenixDocumentHistory {
  past: PhoenixMediaDocument[];
  present: PhoenixMediaDocument;
  future: PhoenixMediaDocument[];
}

export function createDocumentHistory(document: PhoenixMediaDocument): PhoenixDocumentHistory {
  return { past: [], present: document, future: [] };
}

export function commitDocumentHistory(
  history: PhoenixDocumentHistory,
  next: PhoenixMediaDocument,
  limit = 50,
): PhoenixDocumentHistory {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  const past = [...history.past, history.present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
  };
}

export function undoDocumentHistory(history: PhoenixDocumentHistory): PhoenixDocumentHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoDocumentHistory(history: PhoenixDocumentHistory): PhoenixDocumentHistory {
  if (history.future.length === 0) return history;
  const [next, ...future] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future,
  };
}
