import { NextResponse } from 'next/server';
import { db } from '@/db';
import { characters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const list = await db.select().from(characters).where(eq(characters.projectId, projectId));
    return NextResponse.json({
      ok: true,
      data: list.map((c) => ({
        id: c.id,
        universe_id: c.projectId,
        faction_id: c.factionId || undefined,
        name: c.name,
        title: c.title || '',
        role: c.role || '',
        motivations: c.motivations || '',
        fears: c.fears || '',
        powers: c.powers || '',
        weaknesses: c.weaknesses || '',
        relationships: c.relationships || [],
        arc_potential: c.arcPotential || '',
        status: c.status || 'alive',
        canon_status: c.canonStatus || 'draft',
        appearance: c.appearance || '',
        speech_style: c.speechStyle || '',
        version: c.version || 1,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const payload = await req.json();
    const characterId = payload.id || crypto.randomUUID();
    const [existing] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);

    if (existing && existing.projectId !== projectId) {
      return NextResponse.json({ ok: false, error: 'Character project mismatch' }, { status: 400 });
    }

    const values = {
      id: characterId,
      projectId,
      factionId: payload.faction_id || null,
      name: payload.name || 'Unnamed Character',
      title: payload.title || '',
      role: payload.role || '',
      motivations: payload.motivations || '',
      fears: payload.fears || '',
      powers: payload.powers || '',
      weaknesses: payload.weaknesses || '',
      relationships: payload.relationships || [],
      arcPotential: payload.arc_potential || '',
      status: payload.status || 'alive',
      canonStatus: payload.canon_status || 'draft',
      appearance: payload.appearance || '',
      speechStyle: payload.speech_style || '',
      version: payload.version || 1,
      updatedAt: new Date(),
    };
    const action = existing ? 'update' : 'create';

    await db.transaction(async (tx) => {
      if (existing) await tx.update(characters).set(values).where(eq(characters.id, characterId));
      else await tx.insert(characters).values(values);
      await logVersion(tx, {
        projectId,
        userId,
        action,
        entityType: 'character',
        entityId: characterId,
        changeData: values,
      });
    });

    const [c] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
    return NextResponse.json({
      ok: true,
      data: {
        id: c.id,
        universe_id: c.projectId,
        faction_id: c.factionId || undefined,
        name: c.name,
        title: c.title || '',
        role: c.role || '',
        motivations: c.motivations || '',
        fears: c.fears || '',
        powers: c.powers || '',
        weaknesses: c.weaknesses || '',
        relationships: c.relationships || [],
        arc_potential: c.arcPotential || '',
        status: c.status || 'alive',
        canon_status: c.canonStatus || 'draft',
        appearance: c.appearance || '',
        speech_style: c.speechStyle || '',
        version: c.version || 1,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
