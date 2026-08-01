import type { WritingDocument } from './types';

export type PublishingFormat = 'docx' | 'epub';
export interface ExportProfile {
  id: 'editor_submission' | 'review_copy' | 'reader_ebook';
  label: string;
  description: string;
  format: PublishingFormat;
  include_notes: boolean;
  final_only: boolean;
}

export const EXPORT_PROFILES: readonly ExportProfile[] = [
  { id: 'editor_submission', label: 'Editor submission', description: 'DOCX manuscript with all publishable matter and drafts.', format: 'docx', include_notes: false, final_only: false },
  { id: 'review_copy', label: 'Internal review copy', description: 'DOCX working copy including private production notes.', format: 'docx', include_notes: true, final_only: false },
  { id: 'reader_ebook', label: 'Reader EPUB', description: 'EPUB containing only documents marked final.', format: 'epub', include_notes: false, final_only: true },
] as const;

export function getExportProfile(id: string): ExportProfile {
  return EXPORT_PROFILES.find(profile => profile.id === id) ?? EXPORT_PROFILES[0];
}

export function documentsForExportProfile(documents: WritingDocument[], profile: ExportProfile): WritingDocument[] {
  return documents.filter(document => (profile.include_notes || document.kind !== 'notes') && (!profile.final_only || document.status === 'final'));
}
