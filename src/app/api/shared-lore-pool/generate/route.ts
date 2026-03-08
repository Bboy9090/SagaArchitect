/**
 * POST /api/shared-lore-pool/generate
 *
 * Lore Pool Engine — Generate fresh inspiration from Shared Lore Pool patterns.
 *
 * CANON SAFETY: This endpoint uses ONLY shared_archetype / public_template entries.
 * It never outputs direct copies of private canon — all generation is remixed and fresh.
 *
 * ── New body shape (Lore Pool Engine spec) ──────────────────────────────────
 * {
 *   filters: { genre?, tone?, age_band?, theme_tags?, source_type?, source_app? }
 *   count?: number              — number of seeds to generate (default 3, max 10)
 *   generation_mode?: string    — 'fresh_recombination' | 'worldbuilding' (default 'worldbuilding')
 * }
 *
 * Response when generation_mode === 'fresh_recombination':
 * {
 *   results: [{ title, hook, inspiration_tags }]
 *   from_archetypes: string[]
 *   canon_safety_note: string
 * }
 *
 * ── Legacy body shape (still supported) ─────────────────────────────────────
 * {
 *   entry_ids?: string[]
 *   generate_types: ('character' | 'faction' | 'world_concept')[]
 *   genre?: string
 *   tone?: string
 *   theme_tags?: string[]
 * }
 *
 * Legacy response:
 * {
 *   generated: { characters?, factions?, world_concept? }
 *   from_archetypes: string[]
 *   canon_safety_note: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PoolEntry {
  archetype_name: string;
  abstraction_summary: string;
  theme_tags: string[];
  visual_tags?: string[];
  source_type: string;
  category?: string;
  role_type?: string;
  tone?: string;
  genre?: string;
}

interface FreshSeed {
  title: string;
  hook: string;
  inspiration_tags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Accept both new and legacy body shapes
    const raw = await req.json() as Record<string, unknown>;

    // Detect body shape: new format has 'filters' key; legacy has 'generate_types'
    const isNewFormat = 'filters' in raw || 'generation_mode' in raw || 'count' in raw;

    if (isNewFormat) {
      return handleFreshRecombination(req, raw);
    } else {
      return handleLegacyGeneration(req, raw);
    }
  } catch (error) {
    console.error('[shared-lore-pool/generate] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Generation failed', detail: message },
      { status: 500, headers: CORS },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New format: fresh_recombination
// Outputs { results: [{title, hook, inspiration_tags}] }
// ─────────────────────────────────────────────────────────────────────────────

async function handleFreshRecombination(
  req: NextRequest,
  raw: Record<string, unknown>,
) {
  const filters = (raw.filters ?? {}) as Record<string, unknown>;
  const count = Math.min(Math.max(Number(raw.count ?? 3), 1), 10);
  const generationMode = (raw.generation_mode as string | undefined) ?? 'fresh_recombination';

  const genre = filters.genre as string | undefined;
  const tone = filters.tone as string | undefined;
  const ageBand = filters.age_band as string | undefined;
  const sourceType = filters.source_type as string | undefined;
  const sourceApp = filters.source_app as string | undefined;
  const themeTags: string[] = Array.isArray(filters.theme_tags)
    ? (filters.theme_tags as string[])
    : [];

  // Fetch matching pool entries
  const poolUrl = new URL('/api/shared-lore-pool', req.url);
  if (genre) poolUrl.searchParams.set('genre', genre);
  if (tone) poolUrl.searchParams.set('tone', tone);
  if (ageBand) poolUrl.searchParams.set('age_band', ageBand);
  if (sourceType) poolUrl.searchParams.set('source_type', sourceType);
  if (sourceApp) poolUrl.searchParams.set('source_app', sourceApp);
  if (themeTags.length > 0) poolUrl.searchParams.set('theme_tags', themeTags.join(','));

  const poolRes = await fetch(poolUrl.toString());
  const poolData = await poolRes.json() as { entries: PoolEntry[] };
  const archetypes = poolData.entries ?? [];
  const archetypeNames = archetypes.map(a => a.archetype_name);

  if (!process.env.OPENAI_API_KEY) {
    const results = buildMockFreshSeeds(count, archetypes, genre, tone, themeTags);
    return NextResponse.json(
      {
        results,
        generation_mode: generationMode,
        from_archetypes: archetypeNames,
        canon_safety_note:
          '[Mock mode — add OPENAI_API_KEY for AI generation] ' +
          'All output is placeholder inspiration. No private canon has been reproduced.',
      },
      { headers: CORS },
    );
  }

  // ── AI generation ─────────────────────────────────────────────────────
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const archetypeSummaries = archetypes
    .slice(0, 8)
    .map(a => `- [${a.source_type}] ${a.archetype_name}: ${a.abstraction_summary} | themes: ${a.theme_tags.join(', ')}`)
    .join('\n');

  const themeStr = themeTags.length > 0 ? themeTags.join(', ') : 'varied';

  const prompt = `You are the Lore Pool Engine. Using ONLY the following abstracted archetype patterns as thematic seeds, generate ${count} fresh, original story or worldbuilding seeds.

ARCHETYPE PATTERNS (use as inspiration only — do not copy names or exact details):
${archetypeSummaries}

PARAMETERS:
- Genre: ${genre ?? 'fantasy'}
- Tone: ${tone ?? 'varied'}
- Themes: ${themeStr}
- Count: ${count}

CANON SAFETY RULES:
1. Do NOT reproduce any exact archetype name, character name, or world identifier.
2. Recombine themes and patterns into something new.
3. Every seed must feel inspired by — but clearly different from — the source archetypes.

Return a JSON object with one key "results" containing an array of exactly ${count} objects, each with:
- "title": a fresh evocative title (not copying archetype names)
- "hook": one sentence describing the core concept or story hook
- "inspiration_tags": array of 3–5 short tag strings capturing the vibe

Return only valid JSON.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      {
        results: buildMockFreshSeeds(count, archetypes, genre, tone, themeTags),
        generation_mode: generationMode,
        from_archetypes: archetypeNames,
        canon_safety_note: 'AI returned empty response; mock seeds shown instead.',
      },
      { headers: CORS },
    );
  }

  let parsed: { results?: FreshSeed[] };
  try {
    parsed = JSON.parse(content) as { results?: FreshSeed[] };
  } catch {
    console.warn('[SharedLorePool] AI returned malformed JSON; falling back to mock.');
    return NextResponse.json(
      {
        results: buildMockFreshSeeds(count, archetypes, genre, tone, themeTags),
        generation_mode: generationMode,
        from_archetypes: archetypeNames,
        canon_safety_note: 'AI returned malformed JSON; mock seeds shown.',
      },
      { headers: CORS },
    );
  }

  return NextResponse.json(
    {
      results: parsed.results ?? buildMockFreshSeeds(count, archetypes, genre, tone, themeTags),
      generation_mode: generationMode,
      from_archetypes: archetypeNames,
      canon_safety_note:
        'All output is AI-generated inspiration. No private canon has been reproduced. ' +
        'Generated titles and hooks are original — not copies of source archetypes.',
    },
    { headers: CORS },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy format: generate_types → {generated: {characters, factions, world_concept}}
// ─────────────────────────────────────────────────────────────────────────────

async function handleLegacyGeneration(
  req: NextRequest,
  raw: Record<string, unknown>,
) {
  const body = raw as {
    entry_ids?: string[];
    generate_types: ('character' | 'faction' | 'world_concept')[];
    genre?: string;
    tone?: string;
    theme_tags?: string[];
  };

  const { generate_types, genre, tone, theme_tags = [] } = body;

  if (!generate_types || generate_types.length === 0) {
    return NextResponse.json(
      { error: 'generate_types is required and must be a non-empty array' },
      { status: 400, headers: CORS },
    );
  }

  // Fetch archetypes to use as inspiration patterns
  const poolUrl = new URL('/api/shared-lore-pool', req.url);
  if (genre) poolUrl.searchParams.set('genre', genre);
  if (tone) poolUrl.searchParams.set('tone', tone);
  if (theme_tags.length > 0) poolUrl.searchParams.set('theme_tags', theme_tags.join(','));

  const poolRes = await fetch(poolUrl.toString());
  const poolData = await poolRes.json() as { entries: PoolEntry[] };
  const archetypes = poolData.entries ?? [];
  const archetypeNames = archetypes.map(a => a.archetype_name);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      buildMockLegacyGeneration(generate_types, archetypes, genre, tone, theme_tags),
      { headers: CORS },
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const archetypeSummaries = archetypes
    .slice(0, 6)
    .map(a => `- ${a.archetype_name}: ${a.abstraction_summary}`)
    .join('\n');

  const themeGuidance = theme_tags.length > 0
    ? `\nThematic focus: ${theme_tags.join(', ')}`
    : '';

  const genList = generate_types.join(', ');

  const prompt = `You are a worldbuilding inspiration engine. Use the following archetypal patterns as creative seeds to generate ORIGINAL content. Do NOT copy any names, exact descriptions, or canon details from the source archetypes — produce fresh, inspired creations.

ARCHETYPE PATTERNS (inspiration only — do not copy):
${archetypeSummaries}

TASK: Generate the following types of worldbuilding content: ${genList}
Genre: ${genre ?? 'fantasy'}
Tone: ${tone ?? 'epic'}${themeGuidance}

CANON SAFETY RULE: Every output must be clearly different from the archetype patterns above. Use them as thematic springboards only.

Return a JSON object with these fields (only include the ones requested in: ${genList}):
- characters: array of { name, role, motivation, arc_potential, visual_description, tone_note } (if 'character' in generate_types)
- factions: array of { name, type, ideology, objective, internal_tension, visual_description } (if 'faction' in generate_types)
- world_concept: { name, genre, tone, core_conflict, magic_or_tech_note, era, visual_description } (if 'world_concept' in generate_types)

Return only valid JSON.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      buildMockLegacyGeneration(generate_types, archetypes, genre, tone, theme_tags),
      { headers: CORS },
    );
  }

  let generated: Record<string, unknown>;
  try {
    generated = JSON.parse(content) as Record<string, unknown>;
  } catch {
    console.warn('[SharedLorePool] AI returned malformed JSON; falling back to mock.');
    return NextResponse.json(
      buildMockLegacyGeneration(generate_types, archetypes, genre, tone, theme_tags),
      { headers: CORS },
    );
  }

  return NextResponse.json(
    {
      generated,
      from_archetypes: archetypeNames,
      canon_safety_note:
        'All output is AI-generated inspiration. No exact private canon has been reproduced. ' +
        'Generated names and details are original — not copies of source archetypes.',
    },
    { headers: CORS },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock: fresh_recombination seeds (no OpenAI key)
// ─────────────────────────────────────────────────────────────────────────────

function buildMockFreshSeeds(
  count: number,
  archetypes: PoolEntry[],
  genre?: string,
  tone?: string,
  themeTags: string[] = [],
): FreshSeed[] {
  // Combine theme signals from pool entries + caller filters
  const allThemes = [
    ...themeTags,
    ...archetypes.flatMap(a => a.theme_tags),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const allVisual = archetypes.flatMap(a => a.visual_tags ?? []);

  // Template bank — mix archetype signals into varied seeds
  const templates: FreshSeed[] = [
    {
      title: `The ${capitalise(pickRandom(allThemes, 'forgotten'))} Accord`,
      hook: `A wandering mediator must forge peace between two factions whose ancient grudge threatens to consume everything they both swore to protect.`,
      inspiration_tags: [pickRandom(allThemes, 'legacy'), pickRandom(allThemes, 'sacrifice'), genre ?? 'fantasy', 'uneasy alliance'],
    },
    {
      title: `Children of the ${capitalise(pickRandom(allVisual, 'broken gate'))}`,
      hook: `Born in the ruins of a shattered empire, orphans raised by its former enemies must decide whether to rebuild or dismantle what remains.`,
      inspiration_tags: ['aftermath', pickRandom(allThemes, 'memory'), tone ?? 'dark', 'identity vs legacy'],
    },
    {
      title: `The ${capitalise(pickRandom(allThemes, 'ember'))} Keeper`,
      hook: `A lone archivist carries the last record of a forbidden truth — and every faction in the region wants it destroyed or weaponised.`,
      inspiration_tags: ['forbidden knowledge', pickRandom(allThemes, 'sacrifice'), 'lone protector', genre ?? 'fantasy'],
    },
    {
      title: `Veil of ${capitalise(pickRandom(allThemes, 'prophecy'))}`,
      hook: `When a centuries-old prediction begins to unfold on the wrong timeline, a sceptical scholar must decide whether to trust the pattern or break it.`,
      inspiration_tags: ['prophecy', 'doubt', pickRandom(allThemes, 'truth'), tone ?? 'mysterious'],
    },
    {
      title: `The ${capitalise(pickRandom(allThemes, 'iron'))} Covenant`,
      hook: `Two rival orders — bound by a treaty neither signed — discover their shared enemy forged the very treaty to control them both.`,
      inspiration_tags: [pickRandom(allThemes, 'betrayal'), 'secret history', 'rival factions', genre ?? 'fantasy'],
    },
    {
      title: `Last Light at ${capitalise(pickRandom(allVisual, 'the broken tower'))}`,
      hook: `A disgraced soldier returns to the ruin that ended their career to find it inhabited — by the descendants of those they were ordered to destroy.`,
      inspiration_tags: [pickRandom(allThemes, 'redemption'), 'haunted past', tone ?? 'tragic', 'confrontation'],
    },
    {
      title: `The ${capitalise(pickRandom(allThemes, 'ash'))} Parliament`,
      hook: `In a city built on the bones of three fallen kingdoms, a new council must govern without choosing which history to honour.`,
      inspiration_tags: ['conflicting histories', 'new order', pickRandom(allThemes, 'legacy'), genre ?? 'fantasy'],
    },
    {
      title: `Echo of the ${capitalise(pickRandom(allVisual, 'storm'))} Knight`,
      hook: `A soldier whose commander died on a battlefield she survived must carry out their unfinished mission — not knowing if it was ever just.`,
      inspiration_tags: [pickRandom(allThemes, 'duty'), pickRandom(allThemes, 'guilt'), tone ?? 'dark', 'inherited mission'],
    },
    {
      title: `When the ${capitalise(pickRandom(allThemes, 'relic'))} Wakes`,
      hook: `An artifact dormant for three centuries activates — and everyone who touches it sees a different version of how the world should have ended.`,
      inspiration_tags: ['ancient power', 'diverging truths', pickRandom(allThemes, 'relic power'), genre ?? 'fantasy'],
    },
    {
      title: `The ${capitalise(pickRandom(allThemes, 'forgotten'))} Name`,
      hook: `A historian trying to reclaim a censored identity discovers the erasure was deliberate — and the erased person is still alive.`,
      inspiration_tags: ['identity', 'censorship', pickRandom(allThemes, 'truth'), 'found history'],
    },
  ];

  // Return `count` seeds, cycling if needed (always deterministically varied)
  const results: FreshSeed[] = [];
  for (let i = 0; i < count; i++) {
    results.push(templates[i % templates.length]);
  }
  return results;
}

/**
 * Returns a random element from arr, or fallback if arr is empty.
 * Intentionally non-deterministic: creative inspiration tools should produce
 * different seeds on each call to maximise variety for the user.
 */
function pickRandom<T>(arr: T[], fallback: T): T {
  if (!arr.length) return fallback;
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock: legacy worldbuilding generation (no OpenAI key)
// ─────────────────────────────────────────────────────────────────────────────

function buildMockLegacyGeneration(
  generateTypes: string[],
  archetypes: PoolEntry[],
  genre?: string,
  tone?: string,
  themeTags?: string[],
) {
  const archetypeNames = archetypes.map(a => a.archetype_name);
  const combinedThemes = [
    ...(themeTags ?? []),
    ...archetypes.flatMap(a => a.theme_tags).slice(0, 4),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 5).join(', ') || 'conflict and legacy';

  const generated: Record<string, unknown> = {};

  if (generateTypes.includes('character')) {
    generated.characters = [
      {
        name: 'Veran the Unshackled',
        role: 'disgraced soldier turned wandering mercenary',
        motivation: `Seeks to atone for orders blindly followed — inspired by themes of ${combinedThemes}`,
        arc_potential: 'Must choose between past loyalties and a new cause worth dying for',
        visual_description: 'Weathered armor with scratched-out insignia, steel-grey eyes, quiet intensity',
        tone_note: `${tone ?? 'dark'} — carries guilt like armor`,
      },
    ];
  }

  if (generateTypes.includes('faction')) {
    generated.factions = [
      {
        name: 'The Unwritten Compact',
        type: 'underground coalition',
        ideology: `Oral agreements bind tighter than iron — inspired by themes of ${combinedThemes}`,
        objective: 'Preserve a network of safe routes and hidden archives against encroaching authority',
        internal_tension: 'Founding members distrust new recruits; secrecy breeds paranoia',
        visual_description: 'No uniforms — identified by a specific knot pattern worn on left wrist',
      },
    ];
  }

  if (generateTypes.includes('world_concept')) {
    generated.world_concept = {
      name: `The ${genre ?? 'shattered'} Reach`,
      genre: genre ?? 'fantasy',
      tone: tone ?? 'dark',
      core_conflict: `Rival successor states struggle for legitimacy after a cataclysm — themes of ${combinedThemes}`,
      magic_or_tech_note: 'Relic artifacts from a lost civilization still function unpredictably',
      era: 'post-collapse reconstruction era',
      visual_description: 'Patchwork of ruins and new settlements; ancient obelisks repurposed as watchtowers',
    };
  }

  return {
    generated,
    from_archetypes: archetypeNames,
    canon_safety_note:
      '[Mock mode — add OPENAI_API_KEY for AI generation] ' +
      'All output is placeholder content. No private canon has been reproduced.',
  };
}
