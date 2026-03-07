import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ArcType } from '@/lib/types';

const ARC_DESCRIPTIONS: Record<ArcType, string> = {
  trilogy: 'A three-part epic saga with clear acts and world transformation',
  season: 'A contained multi-episode story with clear beginning and resolution',
  hero: 'One character\'s complete journey from origin through trial to destiny',
  villain: 'An antagonist\'s rise, period of power, and inevitable confrontation',
  redemption: 'A broken or fallen character\'s path back to meaning or grace',
  war: 'A large-scale conflict that reshapes the world and everyone in it',
  prophecy: 'A destiny-driven arc exploring fate, choice, and what being chosen truly means',
  empire_fall: 'The collapse of a dominant power and the chaos and opportunity that follows',
};

function mockArc(universeId: string, arcType: ArcType) {
  return {
    universe_id: universeId,
    title: `The ${arcType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} of ${['Ash', 'Fire', 'Shadow', 'Memory', 'Blood'][Math.floor(Math.random() * 5)]}`,
    type: arcType,
    summary: `A ${ARC_DESCRIPTIONS[arcType].toLowerCase()} set against the backdrop of this world's central conflict.`,
    start_point: 'The inciting incident that sets this arc in motion — a discovery, a betrayal, or a choice that cannot be unmade.',
    end_point: 'The resolution: not necessarily victory, but irreversible change. The world after this arc is not the world before it.',
    involved_characters: ['The Protagonist', 'The Antagonist'],
    involved_factions: ['The Ruling Order', 'The Resistance'],
    themes: ['Identity', 'Power and consequence', 'The cost of truth'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { universe, characters, factions, arcType } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ arc: mockArc(universe.id, arcType as ArcType) });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const charList = characters?.slice(0, 5).map((c: { name: string }) => c.name).join(', ') || 'None defined yet';
    const factionList = factions?.slice(0, 4).map((f: { name: string }) => f.name).join(', ') || 'None defined yet';

    const prompt = `Generate a ${arcType} story arc for this universe:

Universe: ${universe.name}
Concept: ${universe.concept}
Genre: ${universe.genre}
Tone: ${universe.tone}
Arc Type Description: ${ARC_DESCRIPTIONS[arcType as ArcType] || arcType}
Current Conflict: ${universe.current_conflict || 'Not specified'}
Available Characters: ${charList}
Available Factions: ${factionList}

Return a JSON object with an "arc" field containing:
- title: string (compelling title for this arc)
- type: "${arcType}"
- summary: string (2-3 paragraph arc overview)
- start_point: string (how the arc begins — the inciting incident)
- end_point: string (how the arc resolves — the climax and aftermath)
- involved_characters: string[] (character names from the list above)
- involved_factions: string[] (faction names from the list above)
- themes: string[] (3-5 thematic strings)

Return only valid JSON.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ arc: mockArc(universe.id, arcType as ArcType) });

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error('Arc generation error:', error);
    return NextResponse.json({ arc: null });
  }
}
