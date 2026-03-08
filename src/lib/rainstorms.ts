/**
 * Rainstorms sync helper — field mapping + API client
 *
 * SagaArchitect and Rainstorms were built from the same spec but with slightly
 * different field names. This module handles the translation so that a universe
 * built in SagaArchitect can be pushed to the Rainstorms FastAPI backend.
 *
 * Field mapping table:
 *
 * SagaArchitect               │ Rainstorms FastAPI
 * ─────────────────────────── │ ──────────────────────────
 * universe.tech_level          │ universe.technology_level
 * universe.themes: string[]    │ universe.core_theme: string  (join ", ")
 * story-context.tone           │ story-context.universe_tone
 * story-context.timeline_ctx   │ story-context.timeline_context: string[]
 */

import type { Universe, Faction, Character, Location, TimelineEvent, StoryArc, LoreRule } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Universe shape expected by the Rainstorms FastAPI POST /api/universes endpoint */
export interface RainstormsUniverse {
  name: string;
  genre: string;
  tone: string;
  concept: string;
  technology_level: string;
  magic_system: string;
  era: string;
  core_theme: string;
  world_overview: string;
  creation_myth: string;
  current_conflict: string;
  prophecy_hooks: string[];
}

/** Full sync payload sent to Rainstorms */
export interface RainstormsSyncPayload {
  universe: RainstormsUniverse;
  factions: Faction[];
  characters: Character[];
  locations: Location[];
  timeline: TimelineEvent[];
  story_arcs: StoryArc[];
  lore_rules: LoreRule[];
}

/** Result of a sync attempt */
export interface RainstormsSyncResult {
  success: boolean;
  universe_id?: string;
  message: string;
  detail?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a SagaArchitect Universe to the Rainstorms Universe schema.
 *
 * Key differences:
 *   - `tech_level` → `technology_level`
 *   - `themes: string[]` → `core_theme: string` (joined with ", ")
 */
export function mapUniverseToRainstorms(universe: Universe): RainstormsUniverse {
  return {
    name: universe.name,
    genre: universe.genre,
    tone: universe.tone,
    concept: universe.concept,
    technology_level: universe.tech_level,
    magic_system: universe.magic_system,
    era: universe.era,
    core_theme: Array.isArray(universe.themes)
      ? universe.themes.join(', ')
      : typeof universe.themes === 'string'
        ? universe.themes
        : '',
    world_overview: universe.world_overview,
    creation_myth: universe.creation_myth,
    current_conflict: universe.current_conflict,
    prophecy_hooks: universe.prophecy_hooks ?? [],
  };
}

/**
 * Build the full sync payload for a universe.
 * Pass this to syncToRainstorms().
 */
export function buildRainstormsSyncPayload(
  universe: Universe,
  factions: Faction[],
  characters: Character[],
  locations: Location[],
  timeline: TimelineEvent[],
  story_arcs: StoryArc[],
  lore_rules: LoreRule[],
): RainstormsSyncPayload {
  return {
    universe: mapUniverseToRainstorms(universe),
    factions,
    characters,
    locations,
    timeline,
    story_arcs,
    lore_rules,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push a universe from SagaArchitect into the Rainstorms backend.
 *
 * Rainstorms must be running and accessible from the browser at `baseUrl`.
 * CORS must be configured on the Rainstorms FastAPI (allow SagaArchitect origin).
 *
 * The function attempts to:
 *  1. POST the universe to Rainstorms (create or upsert)
 *  2. Return the assigned universe_id for subsequent syncs
 *
 * @param baseUrl  Rainstorms base URL, e.g. "https://rainstorms.app"
 * @param payload  Built with buildRainstormsSyncPayload()
 */
export async function syncToRainstorms(
  baseUrl: string,
  payload: RainstormsSyncPayload,
): Promise<RainstormsSyncResult> {
  const url = baseUrl.replace(/\/$/, '');

  try {
    // First try the seed-style sync endpoint which accepts the full payload
    // (includes factions, characters, etc.)
    const syncRes = await fetch(`${url}/api/lore/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (syncRes.ok) {
      const data: { universe_id?: string; id?: string; message?: string } = await syncRes.json();
      return {
        success: true,
        universe_id: data.universe_id ?? data.id,
        message: `Universe synced to Rainstorms${data.universe_id ? ` (ID: ${data.universe_id})` : ''}.`,
      };
    }

    // Fallback: try creating just the universe object
    const createRes = await fetch(`${url}/api/universes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.universe),
    });

    if (createRes.ok) {
      const data: { id?: string; _id?: string; message?: string } = await createRes.json();
      const universeId = data.id ?? data._id;
      return {
        success: true,
        universe_id: universeId,
        message: `Universe created in Rainstorms${universeId ? ` (ID: ${universeId})` : ''}. Note: associated entities (factions, characters, etc.) were not synced — the /api/lore/sync endpoint was not found on the Rainstorms server.`,
      };
    }

    const errorText = await createRes.text();
    return {
      success: false,
      message: 'Failed to sync universe to Rainstorms.',
      detail: `POST /api/universes returned ${createRes.status}: ${errorText}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: 'Could not connect to Rainstorms.',
      detail: message,
    };
  }
}

/**
 * Test connectivity to a Rainstorms backend.
 * Returns true if the server responds to GET /api/universes or GET /api/lore/status.
 */
export async function pingRainstorms(baseUrl: string): Promise<{ reachable: boolean; detail: string }> {
  const url = baseUrl.replace(/\/$/, '');
  try {
    // Try the status endpoint first
    const statusRes = await fetch(`${url}/api/lore/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (statusRes.ok) return { reachable: true, detail: 'LoreEngine status endpoint responded.' };

    // Fall back to universes list
    const universesRes = await fetch(`${url}/api/universes`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (universesRes.ok) return { reachable: true, detail: 'Rainstorms universes endpoint responded.' };

    return { reachable: false, detail: `Server responded with ${universesRes.status}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { reachable: false, detail: message };
  }
}
