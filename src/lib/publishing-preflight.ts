import type { WritingDocument } from './types';
import { countWords } from './writing-documents';

export type PublishingIssueSeverity = 'error' | 'warning';
export interface PublishingIssue { code: string; severity: PublishingIssueSeverity; message: string; document_id?: string }
export interface PublishingReadiness {
  ready: boolean;
  errors: number;
  warnings: number;
  total_words: number;
  publishable_documents: number;
  issues: PublishingIssue[];
}

export function publishableWritingDocuments(documents: WritingDocument[]): WritingDocument[] {
  return documents.filter(document => document.kind !== 'notes');
}

export function analyzePublishingReadiness(title: string, documents: WritingDocument[]): PublishingReadiness {
  const issues: PublishingIssue[] = [];
  const publishable = publishableWritingDocuments(documents);
  const byId = new Map<string, WritingDocument>();
  const duplicateIds = new Set<string>();
  for (const document of documents) {
    if (byId.has(document.id)) duplicateIds.add(document.id);
    else byId.set(document.id, document);
  }
  if (!title.trim()) issues.push({ code: 'missing_project_title', severity: 'error', message: 'Add a project title before publishing.' });
  if (!publishable.length) issues.push({ code: 'no_publishable_documents', severity: 'error', message: 'Add at least one manuscript, chapter, scene, screenplay, or comic script.' });
  for (const id of duplicateIds) issues.push({ code: 'duplicate_document_id', severity: 'error', message: 'Duplicate document identity detected.', document_id: id });

  const titleGroups = new Map<string, WritingDocument[]>();
  for (const document of publishable) {
    if (!document.title.trim()) issues.push({ code: 'missing_document_title', severity: 'error', message: 'A publishable document has no title.', document_id: document.id });
    const normalizedTitle = document.title.trim().toLocaleLowerCase();
    if (normalizedTitle) titleGroups.set(normalizedTitle, [...(titleGroups.get(normalizedTitle) || []), document]);
    if (document.parent_id) {
      const parent = byId.get(document.parent_id);
      if (!parent) issues.push({ code: 'missing_parent', severity: 'error', message: `“${document.title}” points to a missing parent.`, document_id: document.id });
      else if (document.kind !== 'scene' || parent.kind !== 'chapter') issues.push({ code: 'invalid_parent', severity: 'error', message: `“${document.title}” has an unsupported parent relationship.`, document_id: document.id });
    } else if (document.kind === 'scene') {
      issues.push({ code: 'unassigned_scene', severity: 'warning', message: `“${document.title}” is not assigned to a chapter.`, document_id: document.id });
    }
    if (['chapter', 'scene', 'screenplay', 'comic_script'].includes(document.kind) && countWords(document.content) === 0) {
      issues.push({ code: 'empty_document', severity: 'error', message: `“${document.title || 'Untitled'}” has no publishable text.`, document_id: document.id });
    }
    if (document.status !== 'final') issues.push({ code: 'unfinished_document', severity: 'warning', message: `“${document.title || 'Untitled'}” is marked ${document.status}.`, document_id: document.id });
    const visited = new Set<string>([document.id]);
    let parentId = document.parent_id;
    while (parentId) {
      if (visited.has(parentId)) { issues.push({ code: 'cyclic_hierarchy', severity: 'error', message: `“${document.title}” is part of a circular outline.`, document_id: document.id }); break; }
      visited.add(parentId);
      parentId = byId.get(parentId)?.parent_id;
    }
  }
  for (const group of titleGroups.values()) {
    if (group.length > 1) for (const document of group) issues.push({ code: 'duplicate_title', severity: 'warning', message: `“${document.title}” is used more than once.`, document_id: document.id });
  }
  const totalWords = publishable.reduce((sum, document) => sum + countWords(document.content), 0);
  if (publishable.length && totalWords === 0) issues.push({ code: 'empty_manuscript', severity: 'error', message: 'The publishing manuscript contains no words.' });
  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  return { ready: errors === 0, errors, warnings, total_words: totalWords, publishable_documents: publishable.length, issues };
}
