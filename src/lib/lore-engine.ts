/**
 * LoreEngine — The shared canonical intelligence layer
 *
 * Architecture:
 *
 *                    LoreEngine
 *             (canon memory + AI context)
 *
 *             /                        \
 *      SagaArchitect               Rainstorms
 *   (universe builder —          (story generator —
 *      writes canon)               consumes canon)
 *
 * SagaArchitect writes universe data into the engine.
 * Rainstorms calls /api/lore-engine/canon-block to pull a
 * structured context block and inject it into story prompts.
 *
 * Both apps call the same /api/generate/* endpoints,
 * all of which accept a `canonBlock` field for richer generation.
 */

import type {
  Universe,
  Faction,
  Character,
  Location,
  TimelineEvent,
  LoreRule,
  StoryArc,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical context block for a universe.
 * This is the shared "memory" that both SagaArchitect and Rainstorms consume.
 * Passed as JSON in API requests so AI prompts stay consistent with canon.
 */
export interface CanonBlock {
  universe: {
    id: string;
    name: string;
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
  };
  factions: Array<{
    name: string;
    type: string;
    ideology: string;
    leader: string;
    objective: string;
    territory: string;
    allies: string[];
    enemies: string[];
    canon_status: string;
  }>;
  characters: Array<{
    name: string;
    title: string;
    role: string;
    faction_id?: string;
    motivations: string;
    powers: string;
    weaknesses: string;
    status: string;
    arc_potential: string;
    canon_status: string;
  }>;
  locations: Array<{
    name: string;
    type: string;
    region: string;
    description: string;
    strategic_value: string;
    mythic_importance: string;
    canon_status: string;
  }>;
  timeline: Array<{
    title: string;
    era_marker: string;
    summary: string;
    consequences: string;
    canon_status: string;
  }>;
  lore_rules: Array<{
    category: string;
    title: string;
    description: string;
    applies_to: string[];
  }>;
  story_arcs: Array<{
    title: string;
    type: string;
    summary: string;
  }>;
  generated_at: string;
}

export interface CanonBlockInput {
  universe: Universe;
  factions?: Faction[];
  characters?: Character[];
  locations?: Location[];
  timeline?: TimelineEvent[];
  lore_rules?: LoreRule[];
  story_arcs?: StoryArc[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Core functions (pure — no I/O, safe in both browser and server)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a structured CanonBlock from raw universe data.
 * Pure function — no side effects, no I/O.
 * Safe to call on both client and server.
 */
export function buildCanonBlock(input: CanonBlockInput): CanonBlock {
  const {
    universe,
    factions = [],
    characters = [],
    locations = [],
    timeline = [],
    lore_rules = [],
    story_arcs = [],
  } = input;

  return {
    universe: {
      id: universe.id,
      name: universe.name,
      genre: universe.genre,
      tone: universe.tone,
      era: universe.era,
      tech_level: universe.tech_level,
      magic_system: universe.magic_system,
      world_overview: universe.world_overview,
      creation_myth: universe.creation_myth,
      themes: universe.themes ?? [],
      current_conflict: universe.current_conflict,
      prophecy_hooks: universe.prophecy_hooks ?? [],
    },
    factions: factions.map(f => ({
      name: f.name,
      type: f.type,
      ideology: f.ideology,
      leader: f.leader,
      objective: f.objective,
      territory: f.territory,
      allies: f.allies,
      enemies: f.enemies,
      canon_status: f.canon_status,
    })),
    characters: characters.map(c => ({
      name: c.name,
      title: c.title,
      role: c.role,
      faction_id: c.faction_id,
      motivations: c.motivations,
      powers: c.powers,
      weaknesses: c.weaknesses,
      status: c.status,
      arc_potential: c.arc_potential,
      canon_status: c.canon_status,
    })),
    locations: locations.map(l => ({
      name: l.name,
      type: l.type,
      region: l.region,
      description: l.description,
      strategic_value: l.strategic_value,
      mythic_importance: l.mythic_importance,
      canon_status: l.canon_status,
    })),
    timeline: timeline.map(e => ({
      title: e.title,
      era_marker: e.era_marker,
      summary: e.summary,
      consequences: e.consequences,
      canon_status: e.canon_status,
    })),
    lore_rules: lore_rules.map(r => ({
      category: r.category,
      title: r.title,
      description: r.description,
      applies_to: r.applies_to,
    })),
    story_arcs: story_arcs.map(a => ({
      title: a.title,
      type: a.type,
      summary: a.summary,
    })),
    generated_at: new Date().toISOString(),
  };
}

/**
 * Format a CanonBlock as a concise, structured text block for AI prompt injection.
 * Every AI prompt should include this so generated content stays canon-consistent.
 */
export function formatCanonBlockAsPrompt(block: CanonBlock): string {
  const lines: string[] = [];

  lines.push('=== LORE ENGINE CANON CONTEXT ===');
  lines.push(`Universe: ${block.universe.name}`);
  lines.push(
    `Genre: ${block.universe.genre} | Tone: ${block.universe.tone} | Era: ${block.universe.era}`,
  );
  lines.push(
    `Technology: ${block.universe.tech_level} | Magic: ${block.universe.magic_system || 'None'}`,
  );

  if (block.universe.world_overview) {
    lines.push(`\nWorld Overview:\n${block.universe.world_overview}`);
  }

  if (block.universe.current_conflict) {
    lines.push(`\nCurrent Conflict:\n${block.universe.current_conflict}`);
  }

  if (block.universe.themes.length > 0) {
    lines.push(`\nCore Themes: ${block.universe.themes.join(', ')}`);
  }

  if (block.factions.length > 0) {
    lines.push('\nFactions:');
    block.factions.forEach(f => {
      lines.push(`• ${f.name} [${f.type}] — ${f.ideology}`);
      if (f.leader) lines.push(`  Leader: ${f.leader}`);
      if (f.objective) lines.push(`  Objective: ${f.objective}`);
      if (f.allies.length > 0) lines.push(`  Allies: ${f.allies.join(', ')}`);
      if (f.enemies.length > 0) lines.push(`  Enemies: ${f.enemies.join(', ')}`);
    });
  }

  if (block.characters.length > 0) {
    lines.push('\nKey Characters:');
    block.characters.forEach(c => {
      lines.push(`• ${c.name}${c.title ? ` — "${c.title}"` : ''} [${c.status}]`);
      if (c.role) lines.push(`  Role: ${c.role}`);
      if (c.motivations) lines.push(`  Motivation: ${c.motivations}`);
      if (c.powers) lines.push(`  Powers: ${c.powers}`);
      if (c.arc_potential) lines.push(`  Arc: ${c.arc_potential}`);
    });
  }

  if (block.locations.length > 0) {
    lines.push('\nKey Locations:');
    block.locations.slice(0, 6).forEach(l => {
      lines.push(`• ${l.name} [${l.type}, ${l.region}] — ${l.description}`);
    });
  }

  if (block.timeline.length > 0) {
    lines.push('\nTimeline (canonical events):');
    block.timeline.slice(0, 8).forEach(e => {
      if (e.canon_status === 'canon' || e.canon_status === 'draft') {
        lines.push(`• [${e.era_marker}] ${e.title}`);
        if (e.consequences) lines.push(`  → ${e.consequences}`);
      }
    });
  }

  if (block.lore_rules.length > 0) {
    lines.push('\nWorld Rules (must not be contradicted):');
    block.lore_rules.forEach(r => {
      lines.push(`• [${r.category}] ${r.title}: ${r.description}`);
    });
  }

  if (block.universe.prophecy_hooks.length > 0) {
    lines.push('\nProphecy / Mystery Hooks:');
    block.universe.prophecy_hooks.forEach(p => {
      lines.push(`• ${p}`);
    });
  }

  if (block.story_arcs.length > 0) {
    lines.push('\nExisting Story Arcs (do not contradict):');
    block.story_arcs.forEach(a => {
      lines.push(`• "${a.title}" [${a.type}]: ${a.summary}`);
    });
  }

  lines.push('\n=== END CANON CONTEXT ===');
  return lines.join('\n');
}

/**
 * Returns a summary of the canon block — how much lore exists.
 * Useful for UI indicators.
 */
export function getCanonBlockStats(block: CanonBlock): {
  factions: number;
  characters: number;
  locations: number;
  timeline_events: number;
  lore_rules: number;
  story_arcs: number;
  richness: 'empty' | 'sparse' | 'moderate' | 'rich' | 'complete';
} {
  const total =
    block.factions.length +
    block.characters.length +
    block.locations.length +
    block.timeline.length +
    block.lore_rules.length;

  const richness =
    total === 0
      ? 'empty'
      : total < 5
        ? 'sparse'
        : total < 15
          ? 'moderate'
          : total < 30
            ? 'rich'
            : 'complete';

  return {
    factions: block.factions.length,
    characters: block.characters.length,
    locations: block.locations.length,
    timeline_events: block.timeline.length,
    lore_rules: block.lore_rules.length,
    story_arcs: block.story_arcs.length,
    richness,
  };
}
