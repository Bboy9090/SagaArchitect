import { NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!p) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      data: {
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
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    const payload = await req.json();
    
    await db.update(projects).set({
      name: payload.name,
      concept: payload.concept,
      genre: payload.genre,
      tone: payload.tone,
      era: payload.era,
      techLevel: payload.tech_level,
      magicSystem: payload.magic_system,
      worldOverview: payload.world_overview,
      creationMyth: payload.creation_myth,
      themes: payload.themes,
      currentConflict: payload.current_conflict,
      prophecyHooks: payload.prophecy_hooks,
      version: payload.version,
      updatedAt: new Date(),
    }).where(eq(projects.id, id));

    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    
    return NextResponse.json({
      ok: true,
      data: {
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
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
