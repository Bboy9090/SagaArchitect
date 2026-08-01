import type { ProductionType } from './types';

export interface ProductionTemplate {
  type: ProductionType;
  label: string;
  icon: string;
  description: string;
  defaultGenre: string;
  defaultTone: string;
  starterSections: string[];
  deliverables: string[];
}

export const PRODUCTION_TEMPLATES: ProductionTemplate[] = [
  { type: 'novel', label: 'Novel', icon: '✎', description: 'Chapters, scenes, character arcs, and a publication-ready manuscript.', defaultGenre: 'Fantasy', defaultTone: 'Epic', starterSections: ['Premise', 'Chapter Outline', 'Character Arcs', 'World Rules'], deliverables: ['Manuscript', 'Project Bible', 'EPUB/PDF'] },
  { type: 'comic', label: 'Comic', icon: '▤', description: 'Issues, pages, panels, dialogue, captions, and visual direction.', defaultGenre: 'Fantasy', defaultTone: 'Heroic', starterSections: ['Series Premise', 'Issue Outline', 'Page Breakdown', 'Visual Language'], deliverables: ['Comic Script', 'Panel Board', 'Print Package'] },
  { type: 'film', label: 'Film', icon: '▷', description: 'Screenplay structure, scenes, shots, cast, locations, and production notes.', defaultGenre: 'Sci-Fi', defaultTone: 'Cinematic', starterSections: ['Logline', 'Beat Sheet', 'Scene List', 'Production Breakdown'], deliverables: ['Screenplay', 'Shot List', 'Pitch Bible'] },
  { type: 'series', label: 'Series', icon: '▥', description: 'Seasons, episodes, long-form arcs, continuity, and a series bible.', defaultGenre: 'Drama', defaultTone: 'Epic', starterSections: ['Series Engine', 'Season Arc', 'Episode Ledger', 'Cast Arcs'], deliverables: ['Series Bible', 'Pilot', 'Season Outline'] },
  { type: 'game', label: 'Game Narrative', icon: '◇', description: 'World states, quests, dialogue, factions, choices, and narrative systems.', defaultGenre: 'Fantasy', defaultTone: 'Heroic', starterSections: ['Player Fantasy', 'Main Quest', 'World States', 'Dialogue Rules'], deliverables: ['Narrative Bible', 'Quest Map', 'Dialogue Package'] },
  { type: 'world_bible', label: 'World Bible', icon: '◉', description: 'Canon-first worldbuilding for franchises that may span several formats.', defaultGenre: 'Fantasy', defaultTone: 'Mythic', starterSections: ['Cosmology', 'History', 'Cultures', 'Canon Rules'], deliverables: ['World Bible', 'Canon Ledger', 'Franchise Map'] },
];

export function getProductionTemplate(type: ProductionType): ProductionTemplate {
  return PRODUCTION_TEMPLATES.find((template) => template.type === type) ?? PRODUCTION_TEMPLATES[0];
}
