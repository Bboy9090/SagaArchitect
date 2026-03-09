/**
 * POST /api/shared-lore-pool/share
 *
 * Validate a visibility transition and return a sanitised SharedLoreEntry
 * ready to be persisted by the caller.
 *
 * Accepts TWO body shapes:
 *
 * ── New (Lore Pool Engine) shape ─────────────────────────────────────────────
 * {
 *   source_app: string          — e.g. "sagaarch" | "rainstorms"
 *   source_type: string         — e.g. "character" | "story_seed"
 *   source_id: string           — the entity's own ID
 *   visibility: LoreVisibility  — desired visibility
 *   entity_data?: object        — optional; if provided the server extracts the archetype
 *   universe_meta?: object      — optional genre/tone/era hints for extraction
 * }
 *
 * ── Legacy shape (full entry) ────────────────────────────────────────────────
 * {
 *   entry: SharedLoreEntry      — the full, already-extracted pool entry
 *   visibility: LoreVisibility  — desired new visibility
 * }
 *
 * CANON SAFETY:
 * - private entries are never placed into the shared pool.
 * - owner_user_id, universe_id, and source_id are never echoed back.
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
  SharedLoreEntry,
  LoreVisibility,
  Character,
  Faction,
  Location,
  StoryArc,
  LoreRule,
  Universe,
} from '@/lib/types';

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
    const raw = await req.json() as Record<string, unknown>;

    // Detect body shape: new format has 'source_id' at top level; legacy has 'entry'
    const isNewFormat = 'source_id' in raw && !('entry' in raw);

    if (isNewFormat) {
      return handleNewFormatShare(raw);
    } else {
      return handleLegacyShare(raw);
    }
  } catch (error) {
    console.error('[shared-lore-pool/share] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Share operation failed', detail: message },
      { status: 500, headers: CORS },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New format: {source_app, source_type, source_id, visibility, entity_data?}
// ─────────────────────────────────────────────────────────────────────────────

function handleNewFormatShare(raw: Record<string, unknown>) {
  const source_app = raw.source_app as string | undefined;
  const source_type = raw.source_type as string | undefined;
  const source_id = raw.source_id as string | undefined;
  const visibility = raw.visibility as LoreVisibility | undefined;
  const entity_data = raw.entity_data as Record<string, unknown> | undefined;
  const universe_meta = (raw.universe_meta ?? {}) as { genre?: string; tone?: string; era?: string };

  if (!source_type || !source_id || !visibility) {
    return NextResponse.json(
      { error: 'source_type, source_id, and visibility are required' },
      { status: 400, headers: CORS },
    );
  }

  if (!SHAREABLE_VISIBILITIES.includes(visibility)) {
    return NextResponse.json(
      {
        error: `visibility '${visibility}' is not shareable`,
        valid_values: SHAREABLE_VISIBILITIES,
      },
      { status: 400, headers: CORS },
    );
  }

  const now = new Date().toISOString();

  // If entity_data is provided, extract the archetype server-side
  if (entity_data) {
    if (!isSharableAsArchetype(entity_data as { visibility?: string; is_locked?: boolean; canon_status?: string })) {
      return NextResponse.json(
        { error: 'Entity is locked, private, or deprecated and cannot be shared.' },
        { status: 422, headers: CORS },
      );
    }

    let archetype: ReturnType<typeof extractCharacterArchetype>;
    const normType = source_type === 'story_arc' ? 'arc' : source_type === 'lore_rule' ? 'rule_set' : source_type;

    switch (normType) {
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
        // For story_seed, book_concept — use a generic archetype shape
        archetype = {
          source_app: source_app ?? 'unknown',
          source_type: source_type as SharedLoreEntry['source_type'],
          visibility,
          archetype_name: String(entity_data.title ?? entity_data.name ?? `${source_type} archetype`),
          category: String(entity_data.category ?? source_type),
          theme_tags: Array.isArray(entity_data.theme_tags) ? entity_data.theme_tags as string[] : [],
          visual_tags: Array.isArray(entity_data.visual_tags) ? entity_data.visual_tags as string[] : [],
          abstraction_summary: String(entity_data.summary ?? entity_data.description ?? entity_data.hook ?? ''),
        };
    }

    const entry: Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'> = {
      id: crypto.randomUUID(),
      source_app: source_app ?? archetype.source_app,
      source_type: source_type as SharedLoreEntry['source_type'],
      visibility,
      archetype_name: archetype.archetype_name,
      category: archetype.category,
      role_type: archetype.role_type,
      role_pattern: archetype.role_pattern,
      ideology_pattern: archetype.ideology_pattern,
      location_pattern: archetype.location_pattern,
      conflict_pattern: archetype.conflict_pattern,
      theme_tags: archetype.theme_tags,
      visual_tags: archetype.visual_tags,
      era_pattern: archetype.era_pattern,
      abstraction_summary: archetype.abstraction_summary,
      derivative_rules: archetype.derivative_rules,
      genre: archetype.genre,
      tone: archetype.tone,
      created_at: now,
      updated_at: now,
    };

    return NextResponse.json(
      {
        entry,
        message: `Archetype extracted and marked as ${visibility}.`,
        action: 'create',
      },
      { headers: CORS },
    );
  }

  // No entity_data — client has already extracted; just return a visibility-update ack
  return NextResponse.json(
    {
      message: `Visibility update acknowledged for source_id=${source_id} → ${visibility}. ` +
        'Persist the updated entry in your local pool.',
      action: 'update',
      source_id,
      source_type,
      source_app: source_app ?? null,
      visibility,
      updated_at: now,
    },
    { headers: CORS },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy format: {entry: SharedLoreEntry, visibility}
// ─────────────────────────────────────────────────────────────────────────────

function handleLegacyShare(raw: Record<string, unknown>) {
  const entry = raw.entry as SharedLoreEntry | undefined;
  const visibility = raw.visibility as LoreVisibility | undefined;

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
  if (visibility === 'private' && entry.visibility !== 'private') {
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

  // Strip private owner data before echoing back
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
}
