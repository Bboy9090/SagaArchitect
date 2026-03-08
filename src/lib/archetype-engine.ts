/**
 * Archetype Extraction Engine
 *
 * Converts private lore entities into abstracted, shareable archetypes.
 *
 * CANON SAFETY RULES enforced here:
 * - Exact names (character, faction, location) are never included
 * - Direct world identifiers (universe_id, source_id linkages) are stripped
 * - Locked entities (is_locked === true) are rejected before extraction
 * - The output is a pattern/template — not a copy of the original canon
 *
 * Each extract* function returns a Partial<SharedLoreEntry> (without id,
 * source_id, owner_user_id, universe_id, created_at, updated_at).
 * The caller fills in the identity fields and persists the result.
 */

import type {
  Character,
  Faction,
  Location,
  TimelineEvent,
  StoryArc,
  LoreRule,
  Universe,
  SharedLoreEntry,
  SharedLoreSourceType,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Split a free-text string into an array of lowercase trimmed tags. */
function toTags(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[,;.!?/\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0 && t.length < 60);
}

/** Pick the first N non-empty words as visual descriptor tags. */
function visualDescriptors(text: string | undefined, n = 4): string[] {
  if (!text) return [];
  return text
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, n)
    .map(w => w.toLowerCase().replace(/[^a-z0-9 ]/g, ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Character
// ─────────────────────────────────────────────────────────────────────────────

export type ArchetypePayload = Omit<
  SharedLoreEntry,
  'id' | 'source_id' | 'owner_user_id' | 'universe_id' | 'created_at' | 'updated_at'
>;

/**
 * Extract a character archetype.
 * - name, title, faction_id, universe_id are stripped
 * - role, motivations, arc_potential → role_pattern, theme_tags
 * - appearance, speech_style → visual_tags
 */
export function extractCharacterArchetype(
  character: Character,
  universeMeta: { genre?: string; tone?: string; era?: string },
): ArchetypePayload {
  const themeTags = [
    ...toTags(character.motivations),
    ...toTags(character.arc_potential),
    ...toTags(character.fears),
  ].slice(0, 8);

  const visualTags = [
    ...visualDescriptors(character.appearance, 3),
    ...visualDescriptors(character.speech_style, 2),
    character.status,
  ].filter(Boolean).slice(0, 6);

  // role_pattern: generic description based on role + status, no name
  const rolePattern = [
    character.role,
    character.status !== 'alive' ? `(${character.status})` : null,
    character.arc_potential ? `— ${character.arc_potential.split('.')[0]}` : null,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 200);

  // archetype_name: derive from role, not from character name
  const archetypeName = deriveCharacterArchetypeName(character);

  // Determine canonical category label used for pool filtering
  const categoryLabel = deriveCharacterCategory(character);

  return {
    source_app: 'sagaarch',
    source_type: 'character' as SharedLoreSourceType,
    visibility: character.visibility ?? 'shared_archetype',
    archetype_name: archetypeName,
    category: categoryLabel,
    role_type: character.role || undefined,
    role_pattern: rolePattern,
    theme_tags: themeTags,
    visual_tags: visualTags,
    era_pattern: universeMeta.era,
    abstraction_summary:
      `A ${character.role.toLowerCase()} archetype characterized by ` +
      `${character.motivations ? character.motivations.slice(0, 80) : 'unknown motivations'}. ` +
      `Arc potential: ${character.arc_potential ? character.arc_potential.slice(0, 80) : 'unspecified'}.`,
    derivative_rules: character.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact original names or canon links.',
    genre: universeMeta.genre,
    tone: universeMeta.tone,
  };
}

function deriveCharacterCategory(character: Character): string {
  const role = character.role.toLowerCase();
  if (/villain|tyrant|antagonist|corrupted|dark lord|usurper/.test(role)) return 'villain archetype';
  return 'hero archetype';
}

function deriveCharacterArchetypeName(character: Character): string {
  // Use role keywords to produce a descriptive archetype label (no private name)
  const roleWords = character.role.toLowerCase().split(/\s+/).slice(0, 3);
  const statusWord = character.status === 'dead' || character.status === 'missing' ? 'fallen ' : '';
  return `${statusWord}${roleWords.join(' ')} archetype`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Faction
// ─────────────────────────────────────────────────────────────────────────────

export function extractFactionArchetype(
  faction: Faction,
  universeMeta: { genre?: string; tone?: string; era?: string },
): ArchetypePayload {
  const themeTags = [
    ...toTags(faction.ideology),
    ...toTags(faction.objective),
    ...toTags(faction.internal_conflict),
  ].slice(0, 8);

  const visualTags = visualDescriptors(faction.territory, 4);

  return {
    source_app: 'sagaarch',
    source_type: 'faction' as SharedLoreSourceType,
    visibility: faction.visibility ?? 'shared_archetype',
    archetype_name: `${faction.type} faction archetype`,
    category: 'faction type',
    ideology_pattern: faction.ideology.slice(0, 200),
    conflict_pattern: faction.internal_conflict
      ? faction.internal_conflict.slice(0, 200)
      : undefined,
    theme_tags: themeTags,
    visual_tags: visualTags,
    era_pattern: universeMeta.era,
    abstraction_summary:
      `A ${faction.type.toLowerCase()} faction whose ideology is rooted in ` +
      `${faction.ideology.slice(0, 80)}. ` +
      `Primary objective: ${faction.objective.slice(0, 80)}.`,
    derivative_rules: faction.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact faction names or canon links.',
    genre: universeMeta.genre,
    tone: universeMeta.tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Location
// ─────────────────────────────────────────────────────────────────────────────

export function extractLocationArchetype(
  location: Location,
  universeMeta: { genre?: string; tone?: string; era?: string },
): ArchetypePayload {
  const themeTags = [
    ...toTags(location.mythic_importance),
    ...toTags(location.strategic_value),
    location.type,
  ].filter(Boolean).slice(0, 8);

  const visualTags = visualDescriptors(location.description, 5);

  return {
    source_app: 'sagaarch',
    source_type: 'location' as SharedLoreSourceType,
    visibility: location.visibility ?? 'shared_archetype',
    archetype_name: `${location.type} location archetype`,
    category: 'location template',
    location_pattern:
      `${location.type} in ${location.region || 'unknown region'}. ` +
      `${location.description.slice(0, 150)}`,
    theme_tags: themeTags,
    visual_tags: visualTags,
    era_pattern: universeMeta.era,
    abstraction_summary:
      `A ${location.type.toLowerCase()} with strategic significance: ` +
      `${location.strategic_value.slice(0, 80)}. ` +
      `Mythic importance: ${location.mythic_importance.slice(0, 80)}.`,
    derivative_rules: location.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact location names or canon links.',
    genre: universeMeta.genre,
    tone: universeMeta.tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Story Arc
// ─────────────────────────────────────────────────────────────────────────────

export function extractArcArchetype(
  arc: StoryArc,
  universeMeta: { genre?: string; tone?: string; era?: string },
): ArchetypePayload {
  const themeTags = [...arc.themes.map(t => t.toLowerCase()), arc.type].slice(0, 8);
  const visualTags = visualDescriptors(arc.summary, 4);

  return {
    source_app: 'sagaarch',
    source_type: 'arc' as SharedLoreSourceType,
    visibility: arc.visibility ?? 'shared_archetype',
    archetype_name: `${arc.type} arc archetype`,
    category: 'conflict pattern',
    conflict_pattern:
      `${arc.start_point.slice(0, 100)} → ${arc.end_point.slice(0, 100)}`,
    theme_tags: themeTags,
    visual_tags: visualTags,
    era_pattern: universeMeta.era,
    abstraction_summary:
      `A ${arc.type} arc: ${arc.summary.slice(0, 150)}. ` +
      `Spans from "${arc.start_point.slice(0, 60)}" to "${arc.end_point.slice(0, 60)}".`,
    derivative_rules: arc.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact arc titles or canon event links.',
    genre: universeMeta.genre,
    tone: universeMeta.tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Timeline Event → archetypal historical event
// ─────────────────────────────────────────────────────────────────────────────

export function extractTimelineEventArchetype(
  event: TimelineEvent,
  universeMeta: { genre?: string; tone?: string; era?: string },
): ArchetypePayload {
  const themeTags = [
    ...toTags(event.consequences),
    event.era_marker,
  ].filter(Boolean).slice(0, 8);

  const visualTags = visualDescriptors(event.summary, 5);

  return {
    source_app: 'sagaarch',
    source_type: 'arc' as SharedLoreSourceType, // timeline events map to the 'arc' bucket
    visibility: event.visibility ?? 'shared_archetype',
    archetype_name: `historical event archetype (${event.era_marker || 'unknown era'})`,
    category: 'conflict pattern',
    conflict_pattern: event.summary.slice(0, 200),
    theme_tags: themeTags,
    visual_tags: visualTags,
    era_pattern: event.era_marker || universeMeta.era,
    abstraction_summary:
      `An archetypal historical turning point: ${event.summary.slice(0, 150)}. ` +
      `Consequences: ${event.consequences.slice(0, 100)}.`,
    derivative_rules: event.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact event titles, character names, or canon links.',
    genre: universeMeta.genre,
    tone: universeMeta.tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Lore Rule → genre-compatible rule template
// ─────────────────────────────────────────────────────────────────────────────

export function extractLoreRuleArchetype(
  rule: LoreRule,
  universeMeta: { genre?: string; tone?: string; era?: string },
): ArchetypePayload {
  const themeTags = [
    ...toTags(rule.description),
    rule.category.toLowerCase(),
  ].slice(0, 8);

  return {
    source_app: 'sagaarch',
    source_type: 'rule_set' as SharedLoreSourceType,
    visibility: rule.visibility ?? 'shared_archetype',
    archetype_name: `${rule.category.toLowerCase()} rule archetype`,
    category: 'conflict pattern',
    conflict_pattern: rule.description.slice(0, 200),
    theme_tags: themeTags,
    visual_tags: [],
    era_pattern: universeMeta.era,
    abstraction_summary:
      `A ${rule.category.toLowerCase()} world rule: ${rule.description.slice(0, 150)}.`,
    derivative_rules: rule.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact rule titles or canon links.',
    genre: universeMeta.genre,
    tone: universeMeta.tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction: Universe → world seed
// ─────────────────────────────────────────────────────────────────────────────

export function extractWorldSeedArchetype(
  universe: Universe,
): ArchetypePayload {
  const themeTags = [
    ...(universe.themes ?? []).map(t => t.toLowerCase()),
    ...toTags(universe.current_conflict),
  ].slice(0, 8);

  const visualTags = visualDescriptors(universe.world_overview, 5);

  return {
    source_app: 'sagaarch',
    source_type: 'world_seed' as SharedLoreSourceType,
    visibility: universe.visibility ?? 'shared_archetype',
    archetype_name: `${universe.genre} world seed archetype`,
    category: 'world theme',
    ideology_pattern: universe.concept.slice(0, 200),
    conflict_pattern: universe.current_conflict.slice(0, 200),
    theme_tags: themeTags,
    visual_tags: visualTags,
    era_pattern: universe.era,
    abstraction_summary:
      `A ${universe.genre} world with ${universe.tone} tone. ` +
      `Tech level: ${universe.tech_level}. Magic: ${universe.magic_system}. ` +
      `Core conflict: ${universe.current_conflict.slice(0, 100)}.`,
    derivative_rules: universe.allow_derivatives === false
      ? 'No derivatives permitted.'
      : 'Derivatives allowed; do not reproduce exact world names or canon details.',
    genre: universe.genre,
    tone: universe.tone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety guard: reject locked or private entities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the entity is safe to share as an archetype.
 * Locked entities and explicitly private ones are rejected.
 */
export function isSharableAsArchetype(
  entity: { visibility?: string; is_locked?: boolean; canon_status?: string },
): boolean {
  if (entity.is_locked) return false;
  if (entity.visibility === 'private') return false;
  // deprecated / mystery items are not safe for sharing
  if (entity.canon_status === 'deprecated') return false;
  return true;
}
