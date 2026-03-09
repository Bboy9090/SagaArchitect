/**
 * Rainstorms sync helper — field mapping + API client
 *
 * SagaArchitect and Rainstorms were built from the same spec but with slightly
 * different field names. This module handles the translation so that a universe
 * built in SagaArchitect can be pushed to the Rainstorms FastAPI backend.
 *
 * It also provides fetchStoryContextFromSagaArchitect() — the function Rainstorms
 * should call to pull the universe's canon memory packet before generating a story.
 *
 * Environment variables (set in Rainstorms, not SagaArchitect):
 *   SAGA_ARCHITECT_BASE_URL — public URL of the SagaArchitect deployment
 *     e.g.  https://your-sagaarchitect.vercel.app  or  http://localhost:3000
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

// ─────────────────────────────────────────────────────────────────────────────
// Rainstorms ← SagaArchitect: fetch story context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Story context response returned by GET /api/universes/{id}/story-context.
 *
 * Rainstorms should inject prompt_context (a pre-formatted string) as a system
 * message before every story-generation call to stay canon-consistent.
 */
export interface StoryContextResponse {
  universe_id: string;
  universe_name: string;
  tone: string;
  universe_tone: string;      // alias — Rainstorms FastAPI field name
  genre: string;
  era: string;
  magic_system: string;
  tech_level: string;
  technology_level: string;   // alias — Rainstorms FastAPI field name
  themes: string[];
  core_theme: string;         // themes joined with ", " — Rainstorms FastAPI field name
  current_conflict: string;
  prophecy_hooks: string[];
  world_overview: string;
  world_rules: string[];
  relevant_characters: Array<{
    name: string;
    title: string;
    role: string;
    status: string;
    faction_id?: string;
    motivations: string;
    arc_potential: string;
  }>;
  relevant_factions: Array<{
    name: string;
    type: string;
    ideology: string;
    leader: string;
    objective: string;
    territory: string;
  }>;
  relevant_locations: Array<{
    name: string;
    type: string;
    region: string;
    description: string;
  }>;
  timeline_context: string[];       // Rainstorms FastAPI format (string[])
  timeline_context_text: string;    // same events joined as one string
  story_arcs: Array<{ title: string; type: string; summary: string }>;
  prompt_context: string;           // pre-formatted block — inject directly into AI prompt
  stats: {
    factions: number;
    characters: number;
    locations: number;
    timeline_events: number;
    lore_rules: number;
    story_arcs: number;
    richness: 'empty' | 'sparse' | 'moderate' | 'rich' | 'complete';
  };
}

/**
 * Fetch the story context for a universe from a SagaArchitect deployment.
 *
 * Rainstorms must call this (or the equivalent raw HTTP GET) before every
 * story-generation request when a universe is selected. The returned
 * `prompt_context` string is injected as the AI system message to ensure
 * generated stories stay consistent with the universe's established canon.
 *
 * Configure the SagaArchitect URL via the `SAGA_ARCHITECT_BASE_URL` env var
 * in the Rainstorms backend. Never query local MongoDB lore collections when
 * this function is available — SagaArchitect is the canon source of truth.
 *
 * @param baseUrl    SagaArchitect URL from env var SAGA_ARCHITECT_BASE_URL
 *                   e.g. "https://your-sagaarchitect.vercel.app" or "http://localhost:3000"
 * @param universeId Universe ID to fetch context for, e.g. "demo-ashen-veil-001"
 *
 * @throws Error with a descriptive message if the server is unreachable or
 *         returns a non-2xx status. Never silently falls back to empty context.
 *
 * Usage example (Rainstorms backend):
 *
 *   const SAGA_BASE_URL = process.env.SAGA_ARCHITECT_BASE_URL;
 *   const ctx = await fetchStoryContextFromSagaArchitect(SAGA_BASE_URL, universeId);
 *   // ctx.prompt_context → inject into AI generation prompt
 *   // ctx.world_rules    → individual rules array if Rainstorms parses them separately
 *   // ctx.stats.richness → warn user if 'empty' or 'sparse'
 */
export async function fetchStoryContextFromSagaArchitect(
  baseUrl: string,
  universeId: string,
): Promise<StoryContextResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/universes/${universeId}/story-context`;

  console.log(`[LoreEngine] Fetching story context from SagaArchitect: GET ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[LoreEngine] Story context fetch failed for universe "${universeId}": ${detail}`);
    throw new Error(
      `Could not connect to SagaArchitect at ${baseUrl}. ` +
      `Check that SAGA_ARCHITECT_BASE_URL is set correctly and the SagaArchitect ` +
      `server is running. Detail: ${detail}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `[LoreEngine] SagaArchitect returned HTTP ${res.status} for universe "${universeId}". ` +
      `Body: ${body}`,
    );
    throw new Error(
      `SagaArchitect returned HTTP ${res.status} for universe "${universeId}". ` +
      `Ensure the universe exists and is accessible. ` +
      `Hint: use "demo-ashen-veil-001" to test without a full sync. ` +
      `Detail: ${body}`,
    );
  }

  const ctx = (await res.json()) as StoryContextResponse;

  console.log(
    `[LoreEngine] Story context loaded — universe: "${ctx.universe_name}" (${universeId}), ` +
    `richness: ${ctx.stats?.richness ?? 'unknown'}, ` +
    `factions: ${ctx.stats?.factions ?? 0}, ` +
    `characters: ${ctx.stats?.characters ?? 0}.`,
  );

  return ctx;
}
