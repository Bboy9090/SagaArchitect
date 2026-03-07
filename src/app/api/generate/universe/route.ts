import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const MOCK_UNIVERSE = {
  world_overview: 'A world shaped by ancient conflicts and forgotten magic, where the remnants of a fallen civilization struggle to reclaim their destiny. The land bears the scars of cataclysm — shattered cities, toxic wastes, and skies that change color with the tides of unseen power.',
  creation_myth: 'In the age before memory, two primordial forces — the Weavers of Light and the Architects of Silence — shaped the world from raw chaos. They worked together until one grew envious of the other\'s creations. The war that followed broke the sky and seeded the world with contradictions: beauty and devastation, memory and forgetting, power and consequence.',
  themes: ['The cost of power', 'Identity and legacy', 'Survival vs. truth', 'The weight of history'],
  prophecy_hooks: [
    'The heir of the broken line shall either restore what was shattered or shatter what remains.',
    'When three bloodlines unite under a moonless sky, the Archive opens.',
    'The last true name was spoken at the founding. It has not been spoken since.',
  ],
  current_conflict: 'Three factions race to control an ancient artifact capable of rewriting history itself. Each believes their cause is just. Each is partially right — and dangerously wrong.',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(MOCK_UNIVERSE);
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a creative writing assistant specializing in world-building for novels, screenplays, and games.
    
Generate a detailed universe bible entry for the following world:

Name: ${body.name}
Concept: ${body.concept}
Genre: ${body.genre}
Tone: ${body.tone}
Era: ${body.era}
Technology Level: ${body.tech_level}
Magic System: ${body.magic_system || 'None'}
Core Conflict: ${body.current_conflict || 'Not specified'}

Return a JSON object with these exact fields:
- world_overview: (3-4 paragraphs describing the world, its history, and current state)
- creation_myth: (2-3 paragraphs of the world's creation/origin mythology)
- themes: (array of 4-6 core thematic strings)
- prophecy_hooks: (array of 3-4 mysterious prophecy or mystery hook strings)
- current_conflict: (1-2 paragraphs about the central conflict driving the story)

Return only valid JSON, no markdown.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json(MOCK_UNIVERSE);

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error('Universe generation error:', error);
    return NextResponse.json(MOCK_UNIVERSE);
  }
}
