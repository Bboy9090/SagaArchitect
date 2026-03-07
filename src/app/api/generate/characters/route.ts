import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Character } from '@/lib/types';

function mockCharacters(universeId: string): Character[] {
  return [
    {
      id: 'mock-char-1',
      universe_id: universeId,
      name: 'The Unnamed Wanderer',
      title: 'Seeker of Lost Things',
      role: 'Protagonist — searching for the truth beneath the world\'s surface',
      motivations: 'To understand what they lost — and whether it can be reclaimed.',
      fears: 'That the answer, when found, will be worse than the question.',
      powers: 'Uncanny perception — can read the history of objects and places',
      weaknesses: 'Haunted by visions. Cannot trust easily. Carries guilt they cannot name.',
      relationships: [],
      arc_potential: 'Discovers that the thing they lost was sacrificed willingly — to protect them.',
      status: 'alive',
      canon_status: 'draft',
    },
    {
      id: 'mock-char-2',
      universe_id: universeId,
      name: 'The Keeper of Records',
      title: 'Archivist-General',
      role: 'Morally grey authority — knows more than they say',
      motivations: 'Preservation of knowledge at any cost. Even the cost of truth.',
      fears: 'That everything they\'ve preserved was worth destroying.',
      powers: 'Total recall. Can reconstruct any text from fragments.',
      weaknesses: 'Is actively suppressing a discovery that would change everything.',
      relationships: [],
      arc_potential: 'The guardian of truth who has become its censor. Ends when the records are found.',
      status: 'alive',
      canon_status: 'draft',
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { universe, factions } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ characters: mockCharacters(universe.id) });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const factionContext = factions?.length > 0
      ? `\nExisting factions: ${factions.map((f: { name: string }) => f.name).join(', ')}`
      : '';

    const prompt = `Generate 5 compelling characters for this world:

Universe: ${universe.name}
Concept: ${universe.concept}
Genre: ${universe.genre}
Tone: ${universe.tone}${factionContext}

Return a JSON object with a "characters" array. Each character must have:
- name: string
- title: string (their title or epithet)
- role: string (protagonist/antagonist/supporting, with brief description)
- motivations: string
- fears: string
- powers: string (abilities, skills, or resources)
- weaknesses: string
- arc_potential: string (what their story arc could be)
- status: one of "alive" | "dead" | "missing" | "legendary" | "unknown"
- canon_status: one of "canon" | "draft" | "alternate" | "mystery"
- relationships: empty array []

Return only valid JSON.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ characters: mockCharacters(universe.id) });

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error('Character generation error:', error);
    return NextResponse.json({ characters: [] });
  }
}
