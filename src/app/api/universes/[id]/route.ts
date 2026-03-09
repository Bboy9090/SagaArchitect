/**
 * GET /api/universes/{id}
 *
 * Returns the full CanonBlockInput for a universe — the raw, unprocessed lore payload:
 * universe + factions + characters + locations + timeline + lore_rules + story_arcs.
 *
 * This is the same shape accepted by:
 *   - POST /api/lore-engine/canon-block
 *   - POST /api/universes/{id}/story-context
 *
 * Architecture note — localStorage MVP:
 *   User-created universes live in browser localStorage and are inaccessible to the
 *   server. This endpoint returns data for the pre-seeded demo universe only.
 *   For user universes use the "Export Canon" button in the SagaArchitect UI.
 *
 *   Demo universe ID: demo-ashen-veil-001 (The Ashen Veil)
 *
 * Rainstorms integration flow:
 *   1. GET /api/universes                    — list available universes
 *   2. GET /api/universes/{id}               — fetch CanonBlockInput for the universe
 *   3. GET /api/universes/{id}/story-context — fetch processed story context (same data,
 *        processed into the format Rainstorms injects into AI prompts)
 */

import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  if (id !== DEMO_UNIVERSE_ID) {
    return NextResponse.json(
      {
        error: 'Universe not found',
        universe_id: id,
        note:
          'SagaArchitect stores user-created universes in browser localStorage, which is ' +
          'inaccessible to the server. Only the pre-seeded demo universe is available via ' +
          'this GET endpoint. To access a user-created universe, open it in SagaArchitect, ' +
          'click "⚡ Export Canon" on the Canon Core page, and POST the JSON to ' +
          '/api/universes/{id}/story-context or /api/lore-engine/canon-block.',
        demo_universe_id: DEMO_UNIVERSE_ID,
        demo_universe_url: `/api/universes/${DEMO_UNIVERSE_ID}`,
      },
      { status: 404 },
    );
  }

  // Return the full CanonBlockInput — identical shape to what the Export Canon
  // button produces and what POST /api/universes/{id}/story-context accepts.
  return NextResponse.json({
    universe: demoUniverse,
    factions: demoFactions,
    characters: demoCharacters,
    locations: demoLocations,
    timeline: demoTimeline,
    lore_rules: demoLoreRules,
    story_arcs: demoArcs,
    // Convenience links
    story_context_url: `/api/universes/${id}/story-context`,
    canon_block_url: `/api/lore-engine/canon-block`,
  });
}
