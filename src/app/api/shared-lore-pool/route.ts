/**
 * GET /api/shared-lore-pool
 *
 * Returns shared lore pool entries filtered by optional query parameters.
 * Private canon is NEVER included — only shared_archetype and public_template entries.
 * owner_user_id and universe_id are stripped from all responses.
 *
 * Query parameters (all optional):
 *   source_type  — character | faction | location | arc | world_seed | rule_set
 *   genre        — e.g. "fantasy", "sci-fi"
 *   tone         — e.g. "dark", "epic"
 *   age_band     — e.g. "adult", "children"
 *   theme_tags   — comma-separated, e.g. "memory,sacrifice" (OR match)
 *
 * Rainstorms can call this endpoint to get inspiration archetypes.
 */

import { NextRequest, NextResponse } from 'next/server';

// CORS headers — allow Rainstorms to call from any origin
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

import type { SharedLoreEntry, SharedLoreSourceType } from '@/lib/types';

/**
 * Strip private fields before sending to clients.
 * Canon safety: owner_user_id and universe_id are never returned.
 */
function sanitizeEntry(
  entry: SharedLoreEntry,
): Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { owner_user_id, universe_id, source_id, ...safe } = entry;
  return safe;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const sourceType = searchParams.get('source_type') as SharedLoreSourceType | null;
  const genre = searchParams.get('genre')?.toLowerCase();
  const tone = searchParams.get('tone')?.toLowerCase();
  const ageBand = searchParams.get('age_band')?.toLowerCase();
  const themeTagsParam = searchParams.get('theme_tags');
  const requestedTags = themeTagsParam
    ? themeTagsParam.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : [];

  // This is a server-side route — in the localStorage-first MVP we serve a
  // static seed pool so Rainstorms has something to query even before any user
  // explicitly shares archetypes. Entries are appended at build time from the
  // demo universe via the seed data below.
  const seedPool = buildSeedPool();

  let entries = seedPool.filter(e =>
    e.visibility === 'shared_archetype' || e.visibility === 'public_template',
  );

  if (sourceType) {
    entries = entries.filter(e => e.source_type === sourceType);
  }
  if (genre) {
    entries = entries.filter(e => e.genre?.toLowerCase() === genre);
  }
  if (tone) {
    entries = entries.filter(e => e.tone?.toLowerCase() === tone);
  }
  if (ageBand) {
    entries = entries.filter(e => e.age_band?.toLowerCase() === ageBand);
  }
  if (requestedTags.length > 0) {
    entries = entries.filter(e =>
      requestedTags.some(tag => e.theme_tags.includes(tag)),
    );
  }

  return NextResponse.json(
    {
      entries: entries.map(sanitizeEntry),
      total: entries.length,
      filters_applied: {
        source_type: sourceType ?? null,
        genre: genre ?? null,
        tone: tone ?? null,
        age_band: ageBand ?? null,
        theme_tags: requestedTags,
      },
    },
    { headers: CORS },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed pool — demo archetypes derived from The Ashen Veil
// These illustrate the abstraction: no exact names, no direct canon links.
// ─────────────────────────────────────────────────────────────────────────────

function buildSeedPool(): SharedLoreEntry[] {
  const now = new Date().toISOString();
  return [
    // ── Characters ──────────────────────────────────────────────────────────
    {
      id: 'arch-char-001',
      source_type: 'character',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'fallen storm knight archetype',
      category: 'warrior',
      role_pattern: 'last knight of a dying order (missing) — seeking redemption or revenge',
      theme_tags: ['memory', 'sacrifice', 'legacy', 'duty', 'loss'],
      visual_tags: ['storm armor', 'ruined kingdom', 'memory burden', 'scarred warrior'],
      era_pattern: 'empire collapse era',
      abstraction_summary:
        'A reluctant mythic warrior who was the last defender of a collapsed order. ' +
        'Carries both literal and symbolic burdens of a world that no longer exists.',
      derivative_rules: 'Derivatives allowed; do not reproduce exact original names.',
      genre: 'fantasy',
      tone: 'dark epic',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'arch-char-002',
      source_type: 'character',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'exiled oracle archetype',
      category: 'mystic',
      role_pattern: 'oracle (legendary) — cursed with foresight, rejected by those they tried to save',
      theme_tags: ['prophecy', 'isolation', 'truth', 'burden', 'foresight'],
      visual_tags: ['silver eyes', 'grey robes', 'ancient tome', 'mountain hermit'],
      era_pattern: 'post-war era',
      abstraction_summary:
        'A legendary seer whose prophecies came true but were ignored or misused. ' +
        'Lives in self-imposed exile, haunted by what they foresaw and what could not be changed.',
      derivative_rules: 'Derivatives allowed.',
      genre: 'fantasy',
      tone: 'tragic',
      created_at: now,
      updated_at: now,
    },
    // ── Factions ────────────────────────────────────────────────────────────
    {
      id: 'arch-faction-001',
      source_type: 'faction',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'authoritarian empire archetype',
      category: 'empire',
      ideology_pattern: 'order through conquest; stability justifies oppression',
      conflict_pattern: 'noble betrayal — trusted lieutenants undermine the throne from within',
      theme_tags: ['empire', 'conquest', 'order', 'betrayal', 'legacies of war'],
      visual_tags: ['iron banners', 'relic engines', 'legions', 'occupied cities'],
      era_pattern: 'empire peak or decline',
      abstraction_summary:
        'An empire that conquered through superior force and relic-powered technology. ' +
        'Internal fractures from noble factions threaten the stability it values above all else.',
      derivative_rules: 'Derivatives allowed.',
      genre: 'fantasy',
      tone: 'dark epic',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'arch-faction-002',
      source_type: 'faction',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'monastic resistance order archetype',
      category: 'monastic order',
      ideology_pattern: 'preserve ancient knowledge; resist through secrecy and sacrifice',
      conflict_pattern: 'ideological split — preserve or weaponize the old ways',
      theme_tags: ['knowledge', 'resistance', 'sacrifice', 'secrecy', 'tradition'],
      visual_tags: ['grey cloaks', 'hidden citadel', 'ancient scrolls', 'candlelight'],
      era_pattern: 'occupied or post-conquest era',
      abstraction_summary:
        'A secretive monastic order that survived the empire\'s purge by hiding. ' +
        'Internally divided between preservation and active resistance.',
      derivative_rules: 'Derivatives allowed.',
      genre: 'fantasy',
      tone: 'dark epic',
      created_at: now,
      updated_at: now,
    },
    // ── Locations ───────────────────────────────────────────────────────────
    {
      id: 'arch-loc-001',
      source_type: 'location',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'ruined fortress location archetype',
      category: 'fortress',
      location_pattern: 'fortress in ash wastes. A once-mighty stronghold now crumbled, haunted by echoes of its last battle.',
      theme_tags: ['ruins', 'memory', 'ash', 'last stand', 'ghost fortress'],
      visual_tags: ['crumbling towers', 'ash drifts', 'broken gates', 'ember glow'],
      era_pattern: 'post-war era',
      abstraction_summary:
        'A ruined fortress with legendary strategic value. ' +
        'Mythic importance: site of the last stand of a fallen order.',
      derivative_rules: 'Derivatives allowed.',
      genre: 'fantasy',
      tone: 'dark epic',
      created_at: now,
      updated_at: now,
    },
    // ── Story Arcs ──────────────────────────────────────────────────────────
    {
      id: 'arch-arc-001',
      source_type: 'arc',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'empire fall arc archetype',
      category: 'empire_fall',
      conflict_pattern: 'A fractured empire collapses under the weight of its own contradictions → new power vacuum reshapes the world',
      theme_tags: ['collapse', 'empire', 'power vacuum', 'aftermath', 'new order'],
      visual_tags: ['falling banners', 'burning capitals', 'refugees', 'last generals'],
      era_pattern: 'empire decline to collapse',
      abstraction_summary:
        'An empire fall arc following the implosion of a dominant power. ' +
        'Spans from first cracks in legitimacy to total collapse and uncertain aftermath.',
      derivative_rules: 'Derivatives allowed.',
      genre: 'fantasy',
      tone: 'dark epic',
      created_at: now,
      updated_at: now,
    },
    // ── World Seeds ─────────────────────────────────────────────────────────
    {
      id: 'arch-world-001',
      source_type: 'world_seed',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'public_template',
      archetype_name: 'dark fantasy ash world seed',
      category: 'fantasy',
      ideology_pattern: 'post-cataclysm world where ancient power left permanent scars',
      conflict_pattern: 'surviving factions fight over relic technology and magical remnants',
      theme_tags: ['ash', 'ruins', 'relic power', 'survival', 'forgotten gods'],
      visual_tags: ['ash fields', 'floating ruins', 'ember skies', 'broken towers'],
      era_pattern: 'post-cataclysm',
      abstraction_summary:
        'A dark fantasy world shattered by a magical cataclysm. ' +
        'Technology level: relic-powered. Magic: suppressed ash-veil residue. ' +
        'Core tension: control of remaining relics.',
      derivative_rules: 'Full public template — free to use and adapt.',
      genre: 'fantasy',
      tone: 'dark epic',
      age_band: 'adult',
      created_at: now,
      updated_at: now,
    },
    // ── Rule Sets ───────────────────────────────────────────────────────────
    {
      id: 'arch-rule-001',
      source_type: 'rule_set',
      source_id: '__demo__',
      universe_id: '__demo__',
      visibility: 'shared_archetype',
      archetype_name: 'suppressed magic rule archetype',
      category: 'magic system',
      conflict_pattern: 'Magic requires sacrifice or proximity to forbidden zones; unsanctioned use invites catastrophic backlash',
      theme_tags: ['magic cost', 'forbidden knowledge', 'sacrifice', 'suppression'],
      visual_tags: [],
      era_pattern: 'post-cataclysm',
      abstraction_summary:
        'A magic system where power is accessible but dangerous. ' +
        'Using magic extracts a toll — physical, psychological, or metaphysical.',
      derivative_rules: 'Derivatives allowed.',
      genre: 'fantasy',
      tone: 'dark',
      created_at: now,
      updated_at: now,
    },
  ];
}
