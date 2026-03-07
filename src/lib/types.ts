export type CanonStatus = 'canon' | 'draft' | 'alternate' | 'deprecated' | 'mystery';
export type CharacterStatus = 'alive' | 'dead' | 'missing' | 'legendary' | 'unknown';
export type ArcType = 'trilogy' | 'season' | 'hero' | 'villain' | 'redemption' | 'war' | 'prophecy' | 'empire_fall';
export type RelationshipType = 'ally' | 'rival' | 'parent' | 'traitor' | 'mentor' | 'prophecy-linked' | 'enemy' | 'sibling';

export interface Relationship {
  character_id: string;
  character_name: string;
  type: RelationshipType;
}

export interface Universe {
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

export interface Faction {
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
  canon_status: CanonStatus;
}

export interface Character {
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
}

export interface Location {
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

export interface TimelineEvent {
  id: string;
  universe_id: string;
  title: string;
  era_marker: string;
  summary: string;
  affected_characters: string[];
  affected_factions: string[];
  affected_locations: string[];
  consequences: string;
  canon_status: CanonStatus;
}

export interface StoryArc {
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
}

export interface LoreRule {
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
