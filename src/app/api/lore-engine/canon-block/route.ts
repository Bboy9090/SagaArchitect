/**
 * LoreEngine Canon Block API
 *
 * This endpoint is the bridge between SagaArchitect and Rainstorms (and any
 * future tool in the ecosystem). It accepts raw universe data and returns a
 * structured CanonBlock — the shared memory that all tools consume.
 *
 * Rainstorms usage:
 *   POST /api/lore-engine/canon-block
 *   Body: { universe, factions, characters, locations, timeline, lore_rules, story_arcs }
 *   Returns: { canonBlock, promptContext, stats }
 *
 * The `promptContext` field is a pre-formatted string ready to inject into
 * any AI prompt — so stories generated in Rainstorms stay consistent with
 * the canon built in SagaArchitect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildCanonBlock, formatCanonBlockAsPrompt, getCanonBlockStats } from '@/lib/lore-engine';
import type { CanonBlockInput } from '@/lib/lore-engine';

export async function POST(req: NextRequest) {
  try {
    const body: CanonBlockInput = await req.json();

    if (!body.universe) {
      return NextResponse.json(
        { error: 'universe field is required' },
        { status: 400 },
      );
    }

    const canonBlock = buildCanonBlock(body);
    const promptContext = formatCanonBlockAsPrompt(canonBlock);
    const stats = getCanonBlockStats(canonBlock);

    return NextResponse.json({
      canonBlock,
      promptContext,
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Canon block generation error:', error);
    return NextResponse.json(
      { error: 'Failed to build canon block', detail: message },
      { status: 500 },
    );
  }
}

/**
 * GET version: returns schema documentation for the canon block API.
 * Useful for Rainstorms or external tool developers integrating with LoreEngine.
 */
export async function GET() {
  return NextResponse.json({
    name: 'LoreEngine Canon Block API',
    version: '1.0',
    description:
      'Returns a structured canon context block for a universe. ' +
      'Use this endpoint to synchronize lore between SagaArchitect and Rainstorms.',
    endpoint: 'POST /api/lore-engine/canon-block',
    request: {
      universe: 'Universe object (required)',
      factions: 'Faction[] (optional)',
      characters: 'Character[] (optional)',
      locations: 'Location[] (optional)',
      timeline: 'TimelineEvent[] (optional)',
      lore_rules: 'LoreRule[] (optional)',
      story_arcs: 'StoryArc[] (optional)',
    },
    response: {
      canonBlock: 'Structured CanonBlock object',
      promptContext: 'Pre-formatted string for AI prompt injection',
      stats: 'Summary statistics (factions, characters, richness level)',
    },
    ecosystem: {
      SagaArchitect: 'Writes universe data into the LoreEngine',
      Rainstorms: 'Reads canon blocks to generate consistent stories',
      StoryMap: 'Reads timeline and arc data for visual plot mapping (future)',
      GameLore: 'Reads faction and character data for game narrative design (future)',
    },
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
