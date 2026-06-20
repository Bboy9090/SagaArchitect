import { NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_USER_ID = '11111111-1111-4111-8111-111111111111';

export async function GET() {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const list = await db.select().from(projects).where(eq(projects.ownerId, DEFAULT_USER_ID));
    // Transform back to camelCase/expected Universe (Project) structures on frontend if needed
    const mapped = list.map((p) => ({
      id: p.id,
      name: p.name,
      concept: p.concept || '',
      genre: p.genre || '',
      tone: p.tone || '',
      era: p.era || '',
      tech_level: p.techLevel || '',
      magic_system: p.magicSystem || '',
      world_overview: p.worldOverview || '',
      creation_myth: p.creationMyth || '',
      themes: p.themes || [],
      current_conflict: p.currentConflict || '',
      prophecy_hooks: p.prophecyHooks || [],
      version: p.version || 1,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    }));
    return NextResponse.json({ ok: true, data: mapped });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const payload = await req.json();
    const id = payload.id || crypto.randomUUID();
    
    await db.insert(projects).values({
      id,
      ownerId: DEFAULT_USER_ID,
      name: payload.name || 'Untitled Project',
      concept: payload.concept || '',
      genre: payload.genre || '',
      tone: payload.tone || '',
      era: payload.era || '',
      techLevel: payload.tech_level || '',
      magicSystem: payload.magic_system || '',
      worldOverview: payload.world_overview || '',
      creationMyth: payload.creation_myth || '',
      themes: payload.themes || [],
      currentConflict: payload.current_conflict || '',
      prophecyHooks: payload.prophecy_hooks || [],
      version: payload.version || 1,
    });

    const [inserted] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    
    return NextResponse.json({
      ok: true,
      data: {
        id: inserted.id,
        name: inserted.name,
        concept: inserted.concept || '',
        genre: inserted.genre || '',
        tone: inserted.tone || '',
        era: inserted.era || '',
        tech_level: inserted.techLevel || '',
        magic_system: inserted.magicSystem || '',
        world_overview: inserted.worldOverview || '',
        creation_myth: inserted.creationMyth || '',
        themes: inserted.themes || [],
        current_conflict: inserted.currentConflict || '',
        prophecy_hooks: inserted.prophecyHooks || [],
        version: inserted.version || 1,
        created_at: inserted.createdAt.toISOString(),
        updated_at: inserted.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
