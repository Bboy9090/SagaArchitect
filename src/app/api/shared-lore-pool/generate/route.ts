/**
 * POST /api/shared-lore-pool/generate
 *
 * Generate fresh worldbuilding inspiration from Shared Lore Pool patterns.
 *
 * CANON SAFETY: This endpoint uses ONLY archetype patterns. It never outputs
 * direct copies of original private canon — all generation is remixed/new.
 *
 * Request body:
 * {
 *   entry_ids?: string[]    — pool entry IDs to draw from (optional; uses all if empty)
 *   generate_types: ('character' | 'faction' | 'world_concept')[]
 *   genre?: string          — e.g. "fantasy"
 *   tone?: string           — e.g. "dark"
 *   theme_tags?: string[]   — additional thematic guidance
 * }
 *
 * Response:
 * {
 *   generated: {
 *     characters?: GeneratedArchetypeCharacter[]
 *     factions?: GeneratedArchetypeFaction[]
 *     world_concept?: GeneratedWorldConcept
 *   }
 *   from_archetypes: string[]   — archetype_names used as inspiration
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
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
    const poolData = await poolRes.json() as { entries: Array<{ archetype_name: string; abstraction_summary: string; theme_tags: string[]; source_type: string }> };
    const archetypes = poolData.entries ?? [];

    const archetypeNames = archetypes.map(a => a.archetype_name);

    // ── Mock mode (no OpenAI key) ──────────────────────────────────────────
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        buildMockGeneration(generate_types, archetypes, genre, tone, theme_tags),
        { headers: CORS },
      );
    }

    // ── AI generation ─────────────────────────────────────────────────────
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
        buildMockGeneration(generate_types, archetypes, genre, tone, theme_tags),
        { headers: CORS },
      );
    }

    let generated: Record<string, unknown>;
    try {
      generated = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // AI returned malformed JSON — fall back to mock so the caller always
      // receives a usable response rather than a 500 crash.
      console.warn('[SharedLorePool] AI returned malformed JSON; falling back to mock generation.');
      return NextResponse.json(
        buildMockGeneration(generate_types, archetypes, genre, tone, theme_tags),
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
  } catch (error) {
    console.error('Shared lore generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Generation failed', detail: message },
      { status: 500, headers: CORS },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock generation (no OpenAI key)
// ─────────────────────────────────────────────────────────────────────────────

function buildMockGeneration(
  generateTypes: string[],
  archetypes: Array<{ archetype_name: string; abstraction_summary: string; theme_tags: string[]; source_type: string }>,
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
