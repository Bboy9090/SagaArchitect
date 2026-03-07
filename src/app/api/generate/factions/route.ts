import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Faction } from '@/lib/types';

function mockFactions(universeId: string): Faction[] {
  return [
    {
      id: 'mock-faction-1',
      universe_id: universeId,
      name: 'The Order of the Sealed Gate',
      type: 'Military Brotherhood',
      ideology: 'The old wounds must never reopen. Order is the price of survival.',
      leader: 'The High Commander (name withheld)',
      resources: 'Fortified strongholds, trained warrior corps, ancient binding weapons',
      allies: [],
      enemies: ['The Liberation Front'],
      territory: 'The mountain fortresses of the northern pass',
      internal_conflict: 'A younger faction believes the sealed knowledge should be used, not locked away.',
      objective: 'Prevent any faction from accessing the ancient archive and triggering another cataclysm.',
      canon_status: 'draft',
    },
    {
      id: 'mock-faction-2',
      universe_id: universeId,
      name: 'The Liberation Front',
      type: 'Insurgent Network',
      ideology: 'Knowledge belongs to all. The old order\'s fear of history is why we remain enslaved to it.',
      leader: 'The Voice (identity unknown)',
      resources: 'Spy networks, stolen artifacts, the fastest information network in the known world',
      allies: [],
      enemies: ['The Order of the Sealed Gate'],
      territory: 'Embedded in every major city',
      internal_conflict: 'Some members are genuinely idealistic. Others want the archive to sell.',
      objective: 'Open the archive. Let the world know what was hidden.',
      canon_status: 'draft',
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { universe } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ factions: mockFactions(universe.id) });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Generate 4-5 compelling factions for this world:

Universe: ${universe.name}
Concept: ${universe.concept}
Genre: ${universe.genre}
Tone: ${universe.tone}
Current Conflict: ${universe.current_conflict || 'Power struggle over ancient knowledge'}

Return a JSON object with a "factions" array. Each faction must have:
- name: string
- type: string (e.g., "Military Order", "Thieves Guild", "Religious Order")
- ideology: string (core beliefs)
- leader: string (name and title)
- resources: string (what they have)
- allies: string[] (faction names, can be empty)
- enemies: string[] (faction names, can be empty)
- territory: string
- internal_conflict: string
- objective: string (what they want)
- canon_status: "canon" | "draft" | "alternate" | "mystery"

Return only valid JSON.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ factions: mockFactions(universe.id) });

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error('Faction generation error:', error);
    return NextResponse.json({ factions: [] });
  }
}
