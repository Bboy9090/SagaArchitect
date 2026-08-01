import { NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';
import { normalizePublishingMetadata } from '@/lib/publishing-metadata';

function projectResponse(p: typeof projects.$inferSelect) {
  return {
    id: p.id, name: p.name, concept: p.concept || '', genre: p.genre || '', tone: p.tone || '', era: p.era || '',
    tech_level: p.techLevel || '', magic_system: p.magicSystem || '', world_overview: p.worldOverview || '',
    creation_myth: p.creationMyth || '', themes: p.themes || [], current_conflict: p.currentConflict || '',
    prophecy_hooks: p.prophecyHooks || [], publishing_metadata: normalizePublishingMetadata(p.publishingMetadata),
    version: p.version || 1, created_at: p.createdAt.toISOString(), updated_at: p.updatedAt.toISOString(),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    const p = await requireOwnedProject(id, userId);
    return NextResponse.json({
      ok: true,
      data: projectResponse(p),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedProject(id, userId);
    const payload = await req.json();

    const updates: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
    const fields = {
      name: 'name', concept: 'concept', genre: 'genre', tone: 'tone', era: 'era', tech_level: 'techLevel',
      magic_system: 'magicSystem', world_overview: 'worldOverview', creation_myth: 'creationMyth', themes: 'themes',
      current_conflict: 'currentConflict', prophecy_hooks: 'prophecyHooks', version: 'version',
    } as const;
    for (const [input, column] of Object.entries(fields)) {
      if (payload[input] !== undefined) (updates as Record<string, unknown>)[column] = payload[input];
    }
    if (payload.publishing_metadata !== undefined) updates.publishingMetadata = normalizePublishingMetadata(payload.publishing_metadata);

    await db.transaction(async (tx) => {
      await tx.update(projects).set(updates).where(eq(projects.id, id));
      await logVersion(tx, {
        projectId: id,
        userId,
        action: 'update',
        entityType: 'project',
        entityId: id,
        changeData: updates,
      });
    });

    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return NextResponse.json({
      ok: true,
      data: projectResponse(p),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedProject(id, userId);
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

    await db.transaction(async (tx) => {
      await logVersion(tx, {
        projectId: id,
        userId,
        action: 'delete',
        entityType: 'project',
        entityId: id,
        changeData: existing ? { name: existing.name } : { id },
      });
      await tx.delete(projects).where(eq(projects.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
