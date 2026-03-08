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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/universes/{id}/story-context
 *
 * Lightweight version: returns the schema / documentation for this universe's
 * context endpoint. The universe data must be provided via POST (below) since
 * this is a localStorage-backed MVP without a persistent database.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return NextResponse.json({
    universe_id: id,
    description:
      'Story context endpoint for Rainstorms integration. ' +
      'POST to this endpoint with universe data to receive a structured story context block.',
    post_endpoint: `/api/universes/${id}/story-context`,
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
      tone: 'string — injects story tone into Rainstorms prompts',
      world_rules: 'string[] — lore rules the AI must respect',
      relevant_characters: 'Array of character summaries',
      relevant_factions: 'Array of faction summaries',
      relevant_locations: 'Array of location summaries',
      timeline_context: 'string — chronological summary for era setting',
      prompt_context: 'string — pre-formatted block ready for AI prompt injection',
      stats: 'Object with entity counts and canon richness level',
    },
    integration_note:
      'Rainstorms should inject the prompt_context string as a system message ' +
      'before every story generation prompt. This ensures generated stories stay ' +
      'consistent with the universe canon built in SagaArchitect/MythLoreBuilder.',
  });
}

/** OPTIONS — handle CORS preflight for cross-origin POST requests from Rainstorms */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const canonBlock = buildCanonBlock(body);
    const promptContext = formatCanonBlockAsPrompt(canonBlock);
    const stats = getCanonBlockStats(canonBlock);

    // Extract structured fields for Rainstorms to consume individually
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

    // Build a concise timeline context string (chronological summary)
    const MAX_TIMELINE_EVENTS_FOR_CONTEXT = 6;
    const timelineContext = canonBlock.timeline.length > 0
      ? canonBlock.timeline
          .slice(0, MAX_TIMELINE_EVENTS_FOR_CONTEXT)
          .map(e => `[${e.era_marker}] ${e.title}: ${e.summary}`)
          .join('\n')
      : 'No timeline events defined.';

    return NextResponse.json({
      universe_id: id,
      universe_name: canonBlock.universe.name,
      tone: canonBlock.universe.tone,
      genre: canonBlock.universe.genre,
      era: canonBlock.universe.era,
      magic_system: canonBlock.universe.magic_system,
      tech_level: canonBlock.universe.tech_level,
      themes: canonBlock.universe.themes,
      current_conflict: canonBlock.universe.current_conflict,
      prophecy_hooks: canonBlock.universe.prophecy_hooks,
      world_overview: canonBlock.universe.world_overview,
      world_rules: worldRules,
      relevant_characters: relevantCharacters,
      relevant_factions: relevantFactions,
      relevant_locations: relevantLocations,
      timeline_context: timelineContext,
      story_arcs: canonBlock.story_arcs,
      prompt_context: promptContext,
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Story context error:', error);
    return NextResponse.json(
      { error: 'Failed to build story context', detail: message },
      { status: 500 },
    );
  }
}
