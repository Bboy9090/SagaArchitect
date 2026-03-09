import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Location } from '@/lib/types';
import { buildCanonBlock, formatCanonBlockAsPrompt } from '@/lib/lore-engine';
import type { CanonBlockInput } from '@/lib/lore-engine';

function mockLocations(universeId: string): Location[] {
  return [
    {
      id: 'mock-loc-1',
      universe_id: universeId,
      name: 'The Shattered Citadel',
      type: 'Ruined Fortress',
      region: 'Central Wastes',
      description: 'Once the seat of a great empire, now a broken ruin where the walls still whisper in the old tongue. Something ancient still lives here — or waits.',
      strategic_value: 'Controls the only safe pass through the Central Wastes.',
      mythic_importance: 'Where the last emperor made their final stand. The ground is said to remember.',
      canon_status: 'draft',
    },
    {
      id: 'mock-loc-2',
      universe_id: universeId,
      name: 'The Living Archive',
      type: 'City-Library',
      region: 'Eastern Coast',
      description: 'A sprawling city built around a vast repository of pre-cataclysm knowledge. Every stone in the city records what happens nearby.',
      strategic_value: 'Contains the largest collection of historical records in existence.',
      mythic_importance: 'Built on the site of the original cataclysm. The wound has never fully healed.',
      canon_status: 'draft',
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { universe } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ locations: mockLocations(universe.id) });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Inject full canon context so locations tie into existing factions, characters, and timeline
    const canonBlock = buildCanonBlock(body as CanonBlockInput);
    const canonContext = formatCanonBlockAsPrompt(canonBlock);

    const prompt = `${canonContext}\n\nUsing the universe context above, generate 6 compelling locations for this world:

Universe: ${universe.name}
Concept: ${universe.concept}
Genre: ${universe.genre}
Tone: ${universe.tone}

IMPORTANT: Locations must connect to the existing factions, characters, and timeline events in the canon context. Give them strategic or mythic relevance to established lore.

Return a JSON object with a "locations" array. Each location must have:
- name: string
- type: string (e.g., "City", "Fortress", "Wasteland", "Sacred Site")
- region: string
- description: string (2-3 sentences of atmospheric description)
- strategic_value: string (why this location matters politically or militarily)
- mythic_importance: string (why this location matters spiritually or historically)
- canon_status: "canon" | "draft" | "alternate" | "mystery"

Return only valid JSON.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ locations: mockLocations(universe.id) });

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error('Location generation error:', error);
    return NextResponse.json({ locations: [] });
  }
}
