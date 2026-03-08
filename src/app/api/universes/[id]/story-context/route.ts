/**
 * Rainstorms Story Context Endpoint
 *
 * GET /api/universes/{id}/story-context
 *
 * The primary integration point between SagaArchitect/MythLoreBuilder and Rainstorms.
 * Returns a structured story context that Rainstorms injects into its book-generation
 * prompts to produce stories that are consistent with the universe's established canon.
 *
 * Rainstorms usage:
 *   1. User selects universe "The Ashen Veil" in Rainstorms
 *   2. Rainstorms calls GET /api/universes/{id}/story-context
 *   3. Returns tone, world rules, characters, factions, locations, timeline context
 *   4. Rainstorms injects the `prompt_context` string into its generation prompts
 *   5. Generated stories automatically reference correct characters, factions, rules
 *
 * This is a GET endpoint so any external app can call it without a request body.
 * All data comes from localStorage via server-side cookie/query — since this is a
 * localStorage-backed MVP, the universe data must be passed as a query parameter
 * or the endpoint can be called with POST body. We support both patterns here.
 *
 * For the localStorage MVP, the client builds the context client-side using
 * buildCanonBlock() from lore-engine.ts. This endpoint is the server-side equivalent
 * used when another app has the raw universe data to pass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildCanonBlock, formatCanonBlockAsPrompt, getCanonBlockStats } from '@/lib/lore-engine';
import type { CanonBlockInput } from '@/lib/lore-engine';
import {
  DEMO_UNIVERSE_ID,
  demoUniverse,
  demoFactions,
  demoCharacters,
  demoLocations,
  demoTimeline,
  demoArcs,
  demoLoreRules,
} from '@/lib/demo-universe';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Build and return the story context response from a CanonBlockInput.
 * Shared by the GET (demo) and POST (user data) handlers so both
 * return an identical response shape.
 */
function buildStoryContextResponse(id: string, body: CanonBlockInput): ReturnType<typeof NextResponse.json> {
  const canonBlock = buildCanonBlock(body);
  const promptContext = formatCanonBlockAsPrompt(canonBlock);
  const stats = getCanonBlockStats(canonBlock);

  const worldRules = (body.lore_rules ?? [])
    .filter(r => r.canon_status === 'canon' || r.canon_status === 'draft')
    .map(r => `[${r.category}] ${r.title}: ${r.description}`);

  const relevantCharacters = canonBlock.characters.map(c => ({
    name: c.name,
    title: c.title,
    role: c.role,
    status: c.status,
    faction_id: c.faction_id,
    motivations: c.motivations,
    arc_potential: c.arc_potential,
  }));

  const relevantFactions = canonBlock.factions.map(f => ({
    name: f.name,
    type: f.type,
    ideology: f.ideology,
    leader: f.leader,
    objective: f.objective,
    territory: f.territory,
  }));

  const relevantLocations = canonBlock.locations.map(l => ({
    name: l.name,
    type: l.type,
    region: l.region,
    description: l.description,
  }));

  const MAX_TIMELINE_EVENTS_FOR_CONTEXT = 6;
  const timelineContextArray = canonBlock.timeline
    .slice(0, MAX_TIMELINE_EVENTS_FOR_CONTEXT)
    .map(e => `[${e.era_marker}] ${e.title}: ${e.summary}`);

  const timelineContextText = timelineContextArray.length > 0
    ? timelineContextArray.join('\n')
    : 'No timeline events defined.';

  return NextResponse.json({
    universe_id: id,
    universe_name: canonBlock.universe.name,
    tone: canonBlock.universe.tone,
    universe_tone: canonBlock.universe.tone,
    genre: canonBlock.universe.genre,
    era: canonBlock.universe.era,
    magic_system: canonBlock.universe.magic_system,
    tech_level: canonBlock.universe.tech_level,
    technology_level: canonBlock.universe.tech_level,
    themes: canonBlock.universe.themes,
    core_theme: Array.isArray(canonBlock.universe.themes)
      ? canonBlock.universe.themes.join(', ')
      : (canonBlock.universe.themes ?? ''),
    current_conflict: canonBlock.universe.current_conflict,
    prophecy_hooks: canonBlock.universe.prophecy_hooks,
    world_overview: canonBlock.universe.world_overview,
    world_rules: worldRules,
    relevant_characters: relevantCharacters,
    relevant_factions: relevantFactions,
    relevant_locations: relevantLocations,
    timeline_context: timelineContextArray,
    timeline_context_text: timelineContextText,
    story_arcs: canonBlock.story_arcs,
    prompt_context: promptContext,
    stats,
  });
}

/**
 * GET /api/universes/{id}/story-context
 *
 * Returns a processed story context block ready for Rainstorms to inject into
 * AI generation prompts.
 *
 * For the demo universe (id = "demo-ashen-veil-001") this returns real data —
 * no request body needed. Rainstorms can call this endpoint directly to test
 * the integration without needing to export/paste any data first.
 *
 * For user-created universes the server has no data (localStorage MVP). For
 * those universes use POST (below) and pass the CanonBlockInput payload from
 * the SagaArchitect "⚡ Export Canon" button, or call GET /api/universes/{id}
 * first to retrieve the payload and then POST it back.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  // For the demo universe, return real processed story context — no POST body needed.
  // Rainstorms can hit this URL directly to verify the integration is working.
  if (id === DEMO_UNIVERSE_ID) {
    return buildStoryContextResponse(id, {
      universe: demoUniverse,
      factions: demoFactions,
      characters: demoCharacters,
      locations: demoLocations,
      timeline: demoTimeline,
      lore_rules: demoLoreRules,
      story_arcs: demoArcs,
    });
  }

  // For user universes: no server-side data available (localStorage MVP).
  // Return schema documentation so the caller knows how to proceed.
  return NextResponse.json({
    universe_id: id,
    description:
      'Story context endpoint for Rainstorms integration. ' +
      'This universe was not found in the server-side seed data. ' +
      'POST to this endpoint with the universe payload to receive a structured story context block.',
    post_endpoint: `/api/universes/${id}/story-context`,
    get_full_data_for_demo: `/api/universes/${DEMO_UNIVERSE_ID}/story-context`,
    required_fields: {
      universe: 'Universe object (required)',
      factions: 'Faction[] (optional but recommended)',
      characters: 'Character[] (optional but recommended)',
      locations: 'Location[] (optional)',
      timeline: 'TimelineEvent[] (optional)',
      lore_rules: 'LoreRule[] (optional)',
      story_arcs: 'StoryArc[] (optional)',
    },
    response_fields: {
      universe_id: 'string',
      universe_name: 'string',
      tone: 'string',
      universe_tone: 'string — alias for tone (Rainstorms FastAPI field name)',
      genre: 'string',
      era: 'string',
      magic_system: 'string',
      tech_level: 'string',
      technology_level: 'string — alias for tech_level (Rainstorms FastAPI field name)',
      themes: 'string[]',
      core_theme: 'string — themes joined with ", " (Rainstorms FastAPI field name)',
      current_conflict: 'string',
      prophecy_hooks: 'string[]',
      world_overview: 'string',
      world_rules: 'string[] — lore rules (canon + draft only)',
      relevant_characters: 'CharacterSummary[] — { name, title, role, status, faction_id, motivations, arc_potential }',
      relevant_factions: 'FactionSummary[] — { name, type, ideology, leader, objective, territory }',
      relevant_locations: 'LocationSummary[] — { name, type, region, description }',
      timeline_context: 'string[] — chronological event strings, Rainstorms format (max 6)',
      timeline_context_text: 'string — same events joined as a single string, for AI prompt injection',
      story_arcs: 'StoryArcSummary[] — { title, type, summary }',
      prompt_context: 'string — complete pre-formatted canon block ready for AI prompt injection',
      stats: 'CanonStats — { factions, characters, locations, timeline_events, lore_rules, story_arcs, richness }',
    },
    integration_note:
      'For the demo universe call GET /api/universes/demo-ashen-veil-001/story-context — no body needed. ' +
      'For user universes, open SagaArchitect, click "⚡ Export Canon" on the Canon Core page, ' +
      'and POST the exported JSON to this endpoint.',
  });
}

/** OPTIONS — handle CORS preflight for cross-origin POST requests from Rainstorms */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * POST /api/universes/{id}/story-context
 *
 * Full version: accepts universe data, returns structured story context.
 * This is what Rainstorms calls when generating a story from a universe.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body: CanonBlockInput = await req.json();

    if (!body.universe) {
      return NextResponse.json(
        { error: 'universe field is required' },
        { status: 400 },
      );
    }

    if (body.universe.id && body.universe.id !== id) {
      return NextResponse.json(
        { error: 'universe.id does not match route parameter' },
        { status: 400 },
      );
    }

    return buildStoryContextResponse(id, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Story context error:', error);
    return NextResponse.json(
      { error: 'Failed to build story context', detail: message },
      { status: 500 },
    );
  }
}
