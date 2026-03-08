/**
 * Story Generation API — powered by LoreEngine
 *
 * This is the same engine Rainstorms uses to generate stories.
 * The full canon context block is injected into every prompt,
 * ensuring all generated stories are consistent with the universe's canon.
 *
 * This endpoint is the "Rainstorms integration point" for SagaArchitect:
 * generate stories directly from your universe without leaving the app.
 *
 * Two input modes:
 *
 * 1. Full CanonBlockInput (existing) — pass universe + factions + characters + ...
 *    Used by the SagaArchitect UI.
 *
 * 2. lore_universe_id shorthand — pass only { lore_universe_id, format, focusPrompt }
 *    The endpoint fetches the story context from the LoreEngine story-context service
 *    and injects it automatically. This is the mode Rainstorms uses when it calls
 *    SagaArchitect as the canon source of truth.
 *    Currently supported: demo-ashen-veil-001 (The Ashen Veil).
 *    For user universes, pass the full CanonBlockInput instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildCanonBlock, formatCanonBlockAsPrompt } from '@/lib/lore-engine';
import type { CanonBlockInput } from '@/lib/lore-engine';
import type { StoryFormat } from '@/lib/types';
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

const FORMAT_INSTRUCTIONS: Record<StoryFormat, string> = {
  opening_chapter: 'Write the opening chapter of a novel (1500-2500 words). Hook the reader immediately. Establish the world, the protagonist, and the central tension. End on a compelling note that demands the next chapter.',
  short_story: 'Write a complete short story (800-1500 words). Beginning, middle, end. One central conflict. One central character. Emotional resolution.',
  scene: 'Write a single powerful scene (400-800 words). One location. One moment. Maximum tension or revelation. Could be an opening, a turning point, or a climax.',
  book_outline: 'Write a structured book outline. Include: premise, protagonist arc, antagonist arc, three-act structure (act 1: setup, act 2: escalation, act 3: resolution), chapter-by-chapter summary (at least 12 chapters), and thematic statement.',
  children_book: 'Write a complete illustrated children\'s book text (300-600 words). Simple language. Clear moral or emotional message. Vivid imagery. Every paragraph should suggest an illustration. Age 4-8.',
};

const FORMAT_LABELS: Record<StoryFormat, string> = {
  opening_chapter: 'Opening Chapter',
  short_story: 'Short Story',
  scene: 'Scene',
  book_outline: 'Book Outline',
  children_book: 'Children\'s Book',
};

function mockStory(universeId: string, format: StoryFormat, universeName: string): object {
  const formatLabel = FORMAT_LABELS[format];
  return {
    title: `${formatLabel}: The Chronicles of ${universeName}`,
    format,
    content: `[${formatLabel} — powered by LoreEngine]\n\nThis story is set in ${universeName}.\n\nIn a world where the old ways have crumbled and new powers rise from the ruins, a lone figure stands at the crossroads of history. They do not yet know that the choice they are about to make will echo for generations.\n\nThe air carries the scent of ash and something older — memory itself, coiled and waiting.\n\nThis is where it begins.\n\n[To generate a real story using AI, add your OPENAI_API_KEY to .env.local]`,
    featured_characters: [],
    featured_factions: [],
    featured_locations: [],
  };
}

/**
 * Build the AI prompt for story generation.
 * Shared between the lore_universe_id shorthand and the full CanonBlockInput paths.
 */
function buildStoryPrompt(
  canonContext: string,
  storyFormat: StoryFormat,
  focusPrompt?: string,
): string {
  const formatInstruction = FORMAT_INSTRUCTIONS[storyFormat] ?? FORMAT_INSTRUCTIONS.opening_chapter;
  const focusNote = focusPrompt ? `\n\nCreator's focus: ${focusPrompt}` : '';
  return `${canonContext}

You are writing for the universe described above. Every detail you create must be consistent with the canon context. Do not contradict established lore rules, character traits, faction ideologies, or timeline events.

STORY FORMAT: ${FORMAT_LABELS[storyFormat]}
INSTRUCTIONS: ${formatInstruction}${focusNote}

Return a JSON object with:
- title: string (the story's title)
- format: "${storyFormat}"
- content: string (the full story text)
- featured_characters: string[] (names of characters from the canon who appear)
- featured_factions: string[] (names of factions from the canon who appear)
- featured_locations: string[] (names of locations from the canon who appear)

Return only valid JSON.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lore_universe_id,
      format,
      focusPrompt,
      universe,
    } = body as {
      lore_universe_id?: string;
      format: StoryFormat;
      focusPrompt?: string;
      universe?: { id: string; name: string };
    } & Partial<CanonBlockInput>;

    // ─── Mode 2: lore_universe_id shorthand ───────────────────────────────────
    // Rainstorms passes only { lore_universe_id, format } — the endpoint fetches
    // the story context from the LoreEngine service and uses it for generation.
    // This makes SagaArchitect the single source of truth for canon data.
    if (lore_universe_id) {
      console.log(`[LoreEngine] story/generate — lore_universe_id="${lore_universe_id}" received`);

      let canonInput: CanonBlockInput;

      if (lore_universe_id === DEMO_UNIVERSE_ID) {
        console.log(`[LoreEngine] Loading demo universe story context for "${lore_universe_id}"`);
        canonInput = {
          universe: demoUniverse,
          factions: demoFactions,
          characters: demoCharacters,
          locations: demoLocations,
          timeline: demoTimeline,
          lore_rules: demoLoreRules,
          story_arcs: demoArcs,
        };
      } else {
        // Non-demo universes are stored in localStorage (client-side only).
        // The caller must pass the full CanonBlockInput instead of lore_universe_id.
        console.error(
          `[LoreEngine] Universe "${lore_universe_id}" not found in server-side seed data. ` +
          `Pass the full CanonBlockInput (from "Export Canon") for user-created universes.`,
        );
        return NextResponse.json(
          {
            error: 'Universe not found in LoreEngine seed data.',
            universe_id: lore_universe_id,
            hint:
              'The lore_universe_id shorthand only works for the demo universe ' +
              `("${DEMO_UNIVERSE_ID}"). For user-created universes, pass the full ` +
              'CanonBlockInput payload (use the "⚡ Export Canon" button in SagaArchitect ' +
              'and include it in the request body).',
            demo_universe_id: DEMO_UNIVERSE_ID,
          },
          { status: 404 },
        );
      }

      const storyFormat = (format ?? 'opening_chapter') as StoryFormat;

      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          story: mockStory(lore_universe_id, storyFormat, canonInput.universe.name),
        });
      }

      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const canonBlock = buildCanonBlock(canonInput);
      const canonContext = formatCanonBlockAsPrompt(canonBlock);
      const prompt = buildStoryPrompt(canonContext, storyFormat, focusPrompt);

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json({ story: mockStory(lore_universe_id, storyFormat, canonInput.universe.name) });
      }

      console.log(`[LoreEngine] Story generated for universe "${lore_universe_id}" (${storyFormat})`);
      return NextResponse.json({ story: JSON.parse(content) });
    }

    // ─── Mode 1: full CanonBlockInput ─────────────────────────────────────────
    if (!universe) {
      return NextResponse.json({ error: 'universe is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        story: mockStory(universe.id, format ?? 'opening_chapter', universe.name),
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build the full canon context — this is the LoreEngine memory injection
    const canonBlock = buildCanonBlock(body as CanonBlockInput);
    const canonContext = formatCanonBlockAsPrompt(canonBlock);

    const storyFormat = (format ?? 'opening_chapter') as StoryFormat;
    const prompt = buildStoryPrompt(canonContext, storyFormat, focusPrompt);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ story: mockStory(universe.id, storyFormat, universe.name) });
    }

    return NextResponse.json({ story: JSON.parse(content) });
  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json({ story: null });
  }
}
