/**
 * POST /api/shared-lore-pool/extract
 *
 * Server-side archetype extraction endpoint.
 *
 * Converts a private lore entity into a safe, abstracted SharedLoreEntry
 * without exposing the entity to any other party.  The caller submits the full
 * entity payload (already loaded from their own storage) and receives back the
 * abstracted archetype ready to be saved to the pool.
 *
 * CANON SAFETY: The entity data submitted here is never stored on the server.
 * Only the *abstracted pattern* is returned; private names, IDs, and locked
 * canon links are stripped by the archetype extraction engine before the
 * response is built.
 *
 * Request body:
 * {
 *   source_app:   'sagaarch' | 'rainstorms' | string  (default 'sagaarch')
 *   source_type:  'character' | 'faction' | 'location' | 'arc' | 'world_seed' | 'rule_set'
 *   source_id:    string  (the entity's own id — kept for owner reference, not returned publicly)
 *   universe_meta?: { genre?: string; tone?: string; era?: string }
 *   entity_data:  the raw entity object (Character | Faction | Location | StoryArc | LoreRule | Universe)
 * }
 *
 * Response:
 * {
 *   archetype: Omit<SharedLoreEntry, 'id' | 'source_id' | 'owner_user_id' | 'universe_id' | 'created_at' | 'updated_at'>
 *   canon_safety_note: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractCharacterArchetype,
  extractFactionArchetype,
  extractLocationArchetype,
  extractArcArchetype,
  extractLoreRuleArchetype,
  extractWorldSeedArchetype,
  isSharableAsArchetype,
} from '@/lib/archetype-engine';
import type {
  Character,
  Faction,
  Location,
  StoryArc,
  LoreRule,
  Universe,
  SharedLoreSourceType,
} from '@/lib/types';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      source_app?: string;
      source_type: SharedLoreSourceType;
      source_id: string;
      universe_meta?: { genre?: string; tone?: string; era?: string };
      entity_data: Record<string, unknown>;
    };

    const { source_type, entity_data, universe_meta = {} } = body;

    if (!source_type || !entity_data) {
      return NextResponse.json(
        { error: 'source_type and entity_data are required' },
        { status: 400, headers: CORS },
      );
    }

    // Safety guard — reject locked/private entities before extraction
    if (!isSharableAsArchetype(entity_data as { visibility?: string; is_locked?: boolean; canon_status?: string })) {
      return NextResponse.json(
        {
          error: 'Entity is not shareable',
          detail: 'Entity is locked, explicitly private, or deprecated. Only entities with visibility=shared_archetype, public_template, or demo_only can be extracted.',
        },
        { status: 422, headers: CORS },
      );
    }

    let archetype: ReturnType<typeof extractCharacterArchetype>;

    switch (source_type) {
      case 'character':
        archetype = extractCharacterArchetype(entity_data as unknown as Character, universe_meta);
        break;
      case 'faction':
        archetype = extractFactionArchetype(entity_data as unknown as Faction, universe_meta);
        break;
      case 'location':
        archetype = extractLocationArchetype(entity_data as unknown as Location, universe_meta);
        break;
      case 'arc':
        archetype = extractArcArchetype(entity_data as unknown as StoryArc, universe_meta);
        break;
      case 'rule_set':
        archetype = extractLoreRuleArchetype(entity_data as unknown as LoreRule, universe_meta);
        break;
      case 'world_seed':
        archetype = extractWorldSeedArchetype(entity_data as unknown as Universe);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported source_type: ${source_type as string}` },
          { status: 400, headers: CORS },
        );
    }

    return NextResponse.json(
      {
        archetype,
        canon_safety_note:
          'Extraction complete. All private names, world identifiers, and locked canon links ' +
          'have been stripped. Only reusable patterns are returned.',
      },
      { headers: CORS },
    );
  } catch (error) {
    console.error('[shared-lore-pool/extract] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Extraction failed', detail: message },
      { status: 500, headers: CORS },
    );
  }
}
