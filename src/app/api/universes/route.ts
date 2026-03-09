/**
 * GET /api/universes
 *
 * Lists universes available from this SagaArchitect instance.
 *
 * Architecture note — localStorage MVP:
 *   SagaArchitect stores user-created universes in browser localStorage, which is
 *   inaccessible to the Next.js server. This endpoint returns the pre-seeded demo
 *   universes that live as server-side fixtures.
 *
 *   User-created universes are accessible via the "Export Canon" button on each
 *   universe's Canon Core page in the SagaArchitect UI. The exported JSON can be
 *   POSTed to /api/lore-engine/canon-block or /api/universes/{id}/story-context.
 *
 * Rainstorms integration:
 *   1. Call GET /api/universes to see the seed/demo universes
 *   2. Call GET /api/universes/{id} to fetch a full CanonBlockInput payload
 *   3. Call POST /api/universes/{id}/story-context with that payload for a processed
 *      story context block ready to inject into generation prompts
 *   4. For user universes, show the Export Canon button workflow in the Rainstorms UI
 */

import { NextResponse } from 'next/server';
import { DEMO_UNIVERSE_ID, demoUniverse } from '@/lib/demo-universe';

export async function GET() {
  return NextResponse.json({
    universes: [
      {
        id: demoUniverse.id,
        name: demoUniverse.name,
        genre: demoUniverse.genre,
        tone: demoUniverse.tone,
        era: demoUniverse.era,
        concept: demoUniverse.concept,
        created_at: demoUniverse.created_at,
        updated_at: demoUniverse.updated_at,
        // Direct links for Rainstorms to consume
        universe_url: `/api/universes/${demoUniverse.id}`,
        story_context_url: `/api/universes/${demoUniverse.id}/story-context`,
      },
    ],
    total: 1,
    note:
      'SagaArchitect stores user-created universes in browser localStorage, which is ' +
      'inaccessible to the server. This endpoint returns pre-seeded demo universes only. ' +
      'To export a user-created universe, open it in SagaArchitect and click ' +
      '"⚡ Export Canon" on the Canon Core page, then POST the JSON payload to ' +
      '/api/lore-engine/canon-block or /api/universes/{id}/story-context.',
    demo_universe_id: DEMO_UNIVERSE_ID,
  });
}
