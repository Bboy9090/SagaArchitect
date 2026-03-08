export type CanonStatus = 'canon' | 'draft' | 'alternate' | 'deprecated' | 'mystery';
export type CharacterStatus = 'alive' | 'dead' | 'missing' | 'legendary' | 'unknown';
export type ArcType = 'trilogy' | 'season' | 'hero' | 'villain' | 'redemption' | 'war' | 'prophecy' | 'empire_fall';
export type RelationshipType = 'ally' | 'rival' | 'parent' | 'traitor' | 'mentor' | 'prophecy-linked' | 'enemy' | 'sibling';

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
  is_locked?: boolean;           // locked entities are excluded from the shared pool
  is_demo?: boolean;             // marks built-in demo entities
  allow_derivatives?: boolean;   // whether derivative works from the archetype are allowed
  shared_template_id?: string;   // id of the SharedLoreEntry this was shared as
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
  hidden_truths?: string;
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
  turning_points?: string[];
  canon_status?: CanonStatus;
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

export interface LoreConflictEntry {
  id: string;
  universe_id: string;
  type: 'contradiction' | 'duplicate' | 'missing_link' | 'mystery';
  title: string;
  description: string;
  related_entities: string[];
  severity: 'low' | 'medium' | 'high';
}

export type StoryFormat = 'opening_chapter' | 'short_story' | 'scene' | 'book_outline' | 'children_book';

export interface GeneratedStory {
  id: string;
  universe_id: string;
  title: string;
  format: StoryFormat;
  content: string;
  featured_characters: string[];
  featured_factions: string[];
  featured_locations: string[];
  created_at: string;
}

/**
 * A media project is a creative output spawned from a universe.
 * One universe can produce many projects — a book, a game, a comic, a film.
 * This is the record that ties a creative output to its source canon.
 */
export type MediaProjectType =
  | 'book'
  | 'children_book'
  | 'game'
  | 'comic'
  | 'film'
  | 'short_story'
  | 'script';

export type MediaProjectStatus = 'concept' | 'in_progress' | 'complete';

export interface MediaProject {
  id: string;
  universe_id: string;
  type: MediaProjectType;
  title: string;
  summary: string;
  status: MediaProjectStatus;
  featured_characters: string[];
  featured_factions: string[];
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Lore Pool
// ─────────────────────────────────────────────────────────────────────────────

export type SharedLoreSourceType =
  | 'character'
  | 'faction'
  | 'location'
  | 'arc'
  | 'world_seed'
  | 'rule_set';

/**
 * A single entry in the Shared Lore Pool.
 *
 * Private canon is NEVER stored here. All fields are abstracted patterns —
 * names, specific world identifiers, and locked canon links are stripped.
 * Rainstorms can consume these via GET /api/shared-lore-pool for inspiration mode.
 */
export interface SharedLoreEntry {
  id: string;
  source_type: SharedLoreSourceType;
  source_id: string;             // id of the original entity (for owner reference only)
  owner_user_id?: string;        // owner — not exposed in public responses
  universe_id: string;           // source universe (not exposed in public responses)
  visibility: LoreVisibility;
  archetype_name: string;        // e.g. "fallen storm knight"
  category: string;              // e.g. "warrior", "empire", "ancient ruin"
  role_pattern?: string;         // character role pattern
  ideology_pattern?: string;     // faction ideology pattern
  location_pattern?: string;     // location archetype pattern
  conflict_pattern?: string;     // arc or event conflict pattern
  theme_tags: string[];          // e.g. ["memory", "sacrifice", "legacy"]
  visual_tags: string[];         // e.g. ["storm armor", "ruined kingdom"]
  era_pattern?: string;          // e.g. "post-apocalyptic", "ancient empire decline"
  abstraction_summary: string;   // human-readable abstract description
  derivative_rules?: string;     // usage rules for derivatives
  // Rainstorms filter fields (mirrors universe-level metadata)
  genre?: string;
  tone?: string;
  age_band?: string;
  created_at: string;
  updated_at: string;
}
