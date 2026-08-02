export type CanonStatus = 'canon' | 'draft' | 'alternate' | 'deprecated' | 'mystery';
export type CharacterStatus = 'alive' | 'dead' | 'missing' | 'legendary' | 'unknown';
export type ArcType = 'trilogy' | 'season' | 'hero' | 'villain' | 'redemption' | 'war' | 'prophecy' | 'empire_fall';
export type RelationshipType = 'ally' | 'rival' | 'parent' | 'traitor' | 'mentor' | 'prophecy-linked' | 'enemy' | 'sibling';
export type ProductionType = 'novel' | 'comic' | 'film' | 'series' | 'game' | 'world_bible';

export interface PublishingMetadata {
  author?: string;
  publisher?: string;
  language?: string;
  isbn?: string;
  description?: string;
  rights?: string;
}

/**
 * Controls whether a lore entity can contribute to the Shared Lore Pool.
 *
 * private          — never surfaced outside the owner's universe (default)
 * shared_archetype — abstracted pattern visible in the shared pool; exact canon never exposed
 * public_template  — full template publicly copyable
 * demo_only        — visible only in the built-in demo data
 */
export type LoreVisibility = 'private' | 'shared_archetype' | 'public_template' | 'demo_only';

/**
 * Fields added to every lore entity to support the Shared Lore Pool.
 * All fields are optional so existing data remains valid without migration.
 */
export interface LorePoolMeta {
  visibility?: LoreVisibility;
  is_locked?: boolean;
  is_demo?: boolean;
  allow_derivatives?: boolean;
  shared_template_id?: string;
}

export interface Relationship {
  character_id: string;
  character_name: string;
  type: RelationshipType;
}

export interface Universe extends LorePoolMeta {
  id: string;
  user_id?: string;
  name: string;
  production_type?: ProductionType;
  template_sections?: string[];
  target_deliverables?: string[];
  publishing_metadata?: PublishingMetadata;
  concept: string;
  genre: string;
  tone: string;
  era: string;
  tech_level: string;
  magic_system: string;
  world_overview: string;
  creation_myth: string;
  themes: string[];
  current_conflict: string;
  prophecy_hooks: string[];
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface Faction extends LorePoolMeta {
  id: string;
  universe_id: string;
  name: string;
  type: string;
  ideology: string;
  leader: string;
  resources: string;
  allies: string[];
  enemies: string[];
  territory: string;
  internal_conflict: string;
  objective: string;
  symbol?: string;
  canon_status: CanonStatus;
}

export interface Character extends LorePoolMeta {
  id: string;
  universe_id: string;
  faction_id?: string;
  name: string;
  title: string;
  role: string;
  motivations: string;
  fears: string;
  powers: string;
  weaknesses: string;
  relationships: Relationship[];
  arc_potential: string;
  status: CharacterStatus;
  canon_status: CanonStatus;
  appearance?: string;
  speech_style?: string;
}

export interface Location extends LorePoolMeta {
  id: string;
  universe_id: string;
  name: string;
  type: string;
  region: string;
  description: string;
  strategic_value: string;
  mythic_importance: string;
  canon_status: CanonStatus;
}

export interface TimelineEvent extends LorePoolMeta {
  id: string;
  universe_id: string;
  title: string;
  era_marker: string;
  summary: string;
  affected_characters: string[];
  affected_factions: string[];
  affected_locations: string[];
  consequences: string;
  hidden_truths: string;
  canon_status: CanonStatus;
}

export interface StoryArc extends LorePoolMeta {
  id: string;
  universe_id: string;
  title: string;
  type: ArcType;
  summary: string;
  start_point: string;
  end_point: string;
  involved_characters: string[];
  involved_factions: string[];
  themes: string[];
  turning_points: string[];
  canon_status: CanonStatus;
}

export interface LoreRule extends LorePoolMeta {
  id: string;
  universe_id: string;
  category: string;
  title: string;
  description: string;
  applies_to: string[];
  canon_status: CanonStatus;
}

export interface GeneratedStory {
  id: string;
  universe_id: string;
  title: string;
  format: 'scene' | 'chapter' | 'episode' | 'cinematic';
  content: string;
  featured_characters: string[];
  featured_factions: string[];
  featured_locations: string[];
  created_at: string;
}

export interface SharedLoreEntry {
  id: string;
  source_universe_id: string;
  source_entity_id: string;
  source_entity_type: 'character' | 'faction' | 'location' | 'lore_rule' | 'story_arc';
  archetype_name: string;
  archetype_summary: string;
  structural_patterns: string[];
  tags: string[];
  contributor_name?: string;
  license: 'derivative_allowed' | 'attribution_required' | 'reference_only';
  is_featured: boolean;
  remix_count: number;
  created_at: string;
}

export type WritingDocumentKind =
  | 'title_page'
  | 'copyright'
  | 'dedication'
  | 'epigraph'
  | 'foreword'
  | 'preface'
  | 'manuscript'
  | 'chapter'
  | 'scene'
  | 'screenplay'
  | 'comic_script'
  | 'acknowledgements'
  | 'about_author'
  | 'appendix'
  | 'notes';
export type WritingDocumentStatus = 'outline' | 'draft' | 'revision' | 'final';

export interface WritingDocument {
  id: string;
  project_id: string;
  parent_id?: string;
  title: string;
  kind: WritingDocumentKind;
  status: WritingDocumentStatus;
  content: string;
  order: number;
  word_target?: number;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface WritingDocumentRevision {
  id: string;
  document_id: string;
  version: number;
  title: string;
  content: string;
  status: WritingDocumentStatus;
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  title: string;
  summary: string;
  order: number;
  location_id?: string;
  canon_status: CanonStatus;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface StoryboardPanel {
  id: string;
  scene_id: string;
  panel_number: number;
  visual_prompt: string;
  action_description: string;
  dialogue: string;
  camera_shot: string;
  image_base64?: string;
  asset_id?: string;
  version?: number;
  created_at: string;
  updated_at: string;
}
