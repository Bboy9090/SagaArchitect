import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { TimelineEvent } from '@/lib/types';

function mockTimeline(universeId: string): TimelineEvent[] {
  return [
    {
      id: 'mock-evt-1',
      universe_id: universeId,
      title: 'The Age of Union — The Empire at Its Height',
      era_marker: 'Year 400 Before the Break',
      summary: 'The unified empire reaches its greatest extent. Knowledge is shared freely. Peace lasts for three generations.',
      affected_characters: [],
      affected_factions: ['The Founding Order'],
      affected_locations: ['The Imperial Capital'],
      consequences: 'Creates the complacency that allows the cataclysm to occur unnoticed until too late.',
      canon_status: 'canon',
    },
    {
      id: 'mock-evt-2',
      universe_id: universeId,
      title: 'The Cataclysm — The Breaking',
      era_marker: 'Year Zero',
      summary: 'The great experiment fails. The sky fractures. The empire falls in a single night.',
      affected_characters: ['The Last Emperor'],
      affected_factions: ['All factions (destroyed or transformed)'],
      affected_locations: ['The Imperial Capital (ruined)', 'The Central Wastes (created)'],
      consequences: 'The world as known ends. Survivors begin building in the ruins.',
      canon_status: 'canon',
    },
    {
      id: 'mock-evt-3',
      universe_id: universeId,
      title: 'The Wandering Century — Survivors Rebuild',
      era_marker: 'Years 1–100 After the Break',
      summary: 'Scattered survivors form new communities. The first new factions emerge from the chaos.',
      affected_characters: [],
      affected_factions: ['The Order of the Sealed Gate (founded)', 'The Liberation Front (seeds planted)'],
      affected_locations: ['New settlements throughout the ruins'],
      consequences: 'Establishes the current power structure.',
      canon_status: 'canon',
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { universe } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ events: mockTimeline(universe.id) });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Generate 8 historical timeline events for this world:

Universe: ${universe.name}
Concept: ${universe.concept}
Genre: ${universe.genre}
Tone: ${universe.tone}
Current Conflict: ${universe.current_conflict || 'Power struggle'}

Create events spanning from the distant past to the present day, in chronological order.

Return a JSON object with an "events" array. Each event must have:
- title: string
- era_marker: string (e.g., "Year Zero / The Cataclysm" or "150 Years Before Present")
- summary: string (2-3 sentences describing what happened)
- affected_characters: string[] (character names involved)
- affected_factions: string[] (faction names involved)
- affected_locations: string[] (location names involved)
- consequences: string (long-term effects)
- canon_status: "canon" | "draft" | "alternate" | "mystery"

Return only valid JSON.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ events: mockTimeline(universe.id) });

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error('Timeline generation error:', error);
    return NextResponse.json({ events: [] });
  }
}
