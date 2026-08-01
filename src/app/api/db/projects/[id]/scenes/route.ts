import { NextResponse } from 'next/server';
import { db } from '@/db';
import { scenes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const list = await db.select().from(scenes).where(eq(scenes.projectId, projectId));
    list.sort((a, b) => a.order - b.order);
    return NextResponse.json({
      ok: true,
      data: list.map((scene) => ({
        id: scene.id,
        project_id: scene.projectId,
        title: scene.title,
        summary: scene.summary || '',
        order: scene.order,
        location_id: scene.locationId || undefined,
        canon_status: scene.canonStatus || 'draft',
        version: scene.version || 1,
        created_at: scene.createdAt.toISOString(),
        updated_at: scene.updatedAt.toISOString(),
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
    const sceneId = payload.id || crypto.randomUUID();
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);

    if (existing && existing.projectId !== projectId) {
      return NextResponse.json({ ok: false, error: 'Scene project mismatch' }, { status: 400 });
    }

    const values = {
      id: sceneId,
      projectId,
      title: payload.title || 'Untitled Scene',
      summary: payload.summary || '',
      order: typeof payload.order === 'number' ? payload.order : 0,
      locationId: payload.location_id || null,
      canonStatus: payload.canon_status || 'draft',
      version: payload.version || 1,
      updatedAt: new Date(),
    };
    const action = existing ? 'update' : 'create';

    await db.transaction(async (tx) => {
      if (existing) await tx.update(scenes).set(values).where(eq(scenes.id, sceneId));
      else await tx.insert(scenes).values(values);
      await logVersion(tx, {
        projectId,
        userId,
        action,
        entityType: 'scene',
        entityId: sceneId,
        changeData: values,
      });
    });

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);
    return NextResponse.json({
      ok: true,
      data: {
        id: scene.id,
        project_id: scene.projectId,
        title: scene.title,
        summary: scene.summary || '',
        order: scene.order,
        location_id: scene.locationId || undefined,
        canon_status: scene.canonStatus || 'draft',
        version: scene.version || 1,
        created_at: scene.createdAt.toISOString(),
        updated_at: scene.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
