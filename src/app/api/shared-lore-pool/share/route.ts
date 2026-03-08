/**
 * POST /api/shared-lore-pool/share
 *
 * Validate a visibility transition and return a sanitised SharedLoreEntry
 * ready to be persisted by the caller.
 *
 * This endpoint does NOT persist anything server-side (SagaARCH is a
 * localStorage-first app).  It enforces canon-safety rules around visibility
 * changes and returns the sanitised, updated entry.
 *
 * CANON SAFETY:
 * - 'private' entries are rejected — they must never enter the pool.
 * - 'shared_archetype' and 'public_template' entries are accepted.
 * - Any transition *to* private is also accepted (de-listing from pool).
 *
 * Request body:
 * {
 *   entry:      SharedLoreEntry (full entry to update/create)
 *   visibility: LoreVisibility  (desired new visibility)
 * }
 *
 * Response:
 * {
 *   entry:    sanitised SharedLoreEntry with updated visibility + timestamps
 *   message:  human-readable confirmation
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SharedLoreEntry, LoreVisibility } from '@/lib/types';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Visibility values that are safe to share externally
const SHAREABLE_VISIBILITIES: LoreVisibility[] = ['shared_archetype', 'public_template', 'demo_only'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      entry: SharedLoreEntry;
      visibility: LoreVisibility;
    };

    const { entry, visibility } = body;

    if (!entry || !entry.id || !entry.source_type || !entry.archetype_name) {
      return NextResponse.json(
        { error: 'entry with id, source_type, and archetype_name is required' },
        { status: 400, headers: CORS },
      );
    }

    if (!visibility) {
      return NextResponse.json(
        { error: 'visibility is required' },
        { status: 400, headers: CORS },
      );
    }

    // Canon safety: prevent placing an entry into the pool with private visibility
    // (private → private is fine as a no-op, but sharing a private item into the pool is disallowed)
    if (visibility === 'private' && entry.visibility !== 'private') {
      // De-listing from pool — allowed; caller should delete the pool entry client-side.
      return NextResponse.json(
        {
          entry: { ...entry, visibility, updated_at: new Date().toISOString() },
          message: 'Visibility set to private. Remove this entry from the pool in your local storage.',
          action: 'remove_from_pool',
        },
        { headers: CORS },
      );
    }

    if (!SHAREABLE_VISIBILITIES.includes(visibility)) {
      return NextResponse.json(
        {
          error: `Invalid visibility: ${visibility}`,
          valid_values: SHAREABLE_VISIBILITIES,
        },
        { status: 400, headers: CORS },
      );
    }

    // Ensure private owner data is never echoed back in the response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { owner_user_id, universe_id, source_id, ...safeEntry } = entry;

    const updated: Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'> = {
      ...safeEntry,
      visibility,
      updated_at: new Date().toISOString(),
    };

    const messages: Record<LoreVisibility, string> = {
      shared_archetype: 'Entry marked as shared_archetype. Abstracted pattern is visible in the pool.',
      public_template: 'Entry marked as public_template. Reusable template is fully visible in the pool.',
      demo_only: 'Entry marked as demo_only. Visible only as official showcase content.',
      private: 'Entry is private.',
    };

    return NextResponse.json(
      {
        entry: updated,
        message: messages[visibility],
        action: 'update',
      },
      { headers: CORS },
    );
  } catch (error) {
    console.error('[shared-lore-pool/share] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Share operation failed', detail: message },
      { status: 500, headers: CORS },
    );
  }
}
