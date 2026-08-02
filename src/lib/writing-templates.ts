import type { ProductionType, WritingDocument, WritingDocumentKind } from './types';

interface TemplateSection { title: string; kind: WritingDocumentKind; prompt: string; word_target?: number }
export interface WritingTemplate { type: ProductionType; label: string; sections: readonly TemplateSection[] }

export const WRITING_TEMPLATES: Record<ProductionType, WritingTemplate> = {
  novel: { type: 'novel', label: 'Novel manuscript', sections: [
    { title: 'Title Page', kind: 'title_page', prompt: 'Title\nAuthor' }, { title: 'Chapter One', kind: 'chapter', prompt: 'Opening image, disruption, and first irreversible choice.', word_target: 3000 }, { title: 'Chapter Two', kind: 'chapter', prompt: 'Escalate the cost and narrow the protagonist’s options.', word_target: 3000 }, { title: 'About the Author', kind: 'about_author', prompt: 'Professional author biography.' },
  ] },
  comic: { type: 'comic', label: 'Comic issue', sections: [
    { title: 'Issue Script', kind: 'comic_script', prompt: 'PAGE 1 (5 PANELS)\nPANEL 1 — Establishing image.\nCAPTION:\nDIALOGUE:', word_target: 4500 }, { title: 'Character Notes', kind: 'notes', prompt: 'Visual continuity, costumes, powers, and lettering notes.' },
  ] },
  film: { type: 'film', label: 'Feature screenplay', sections: [
    { title: 'Feature Screenplay', kind: 'screenplay', prompt: 'FADE IN:\n\nEXT. LOCATION — DAY\n\nAction line.', word_target: 15000 }, { title: 'Production Notes', kind: 'notes', prompt: 'Locations, cast, props, effects, and continuity.' },
  ] },
  series: { type: 'series', label: 'Series pilot', sections: [
    { title: 'Pilot Script', kind: 'screenplay', prompt: 'TEASER\n\nFADE IN:', word_target: 8000 }, { title: 'Season Arc', kind: 'notes', prompt: 'Episode spine, escalation, midpoint reversal, and finale promise.' },
  ] },
  game: { type: 'game', label: 'Narrative game', sections: [
    { title: 'Main Story', kind: 'manuscript', prompt: 'Player fantasy, inciting mission, critical path, and ending states.' }, { title: 'Quest Design', kind: 'notes', prompt: 'Quest ID, prerequisites, objectives, branches, rewards, and failure states.' }, { title: 'Dialogue Script', kind: 'screenplay', prompt: 'SPEAKER: Dialogue\n[CHOICE] Player response → consequence.' },
  ] },
  world_bible: { type: 'world_bible', label: 'World bible', sections: [
    { title: 'World Overview', kind: 'manuscript', prompt: 'Core premise, tone, rules, history, cultures, and present conflict.' }, { title: 'Canon Rules', kind: 'notes', prompt: 'Immutable truths, flexible assumptions, prohibited contradictions.' }, { title: 'Story Engines', kind: 'notes', prompt: 'Repeatable conflicts and franchise-scale story opportunities.' },
  ] },
};

export function instantiateWritingTemplate(type: ProductionType, projectId: string, projectTitle: string, existing: WritingDocument[], idFactory: () => string, now = new Date().toISOString()): WritingDocument[] {
  const template = WRITING_TEMPLATES[type];
  const identities = new Set(existing.map(document => `${document.kind}:${document.title.trim().toLocaleLowerCase()}`));
  return template.sections.flatMap(section => {
    const title = section.kind === 'title_page' ? projectTitle : section.title;
    if (identities.has(`${section.kind}:${title.trim().toLocaleLowerCase()}`)) return [];
    return [{ id: idFactory(), project_id: projectId, title, kind: section.kind, status: 'outline' as const, content: section.prompt, order: existing.length, word_target: section.word_target, created_at: now, updated_at: now }];
  }).map((document, index) => ({ ...document, order: existing.length + index }));
}
