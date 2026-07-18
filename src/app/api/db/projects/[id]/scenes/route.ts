import { NextResponse } from 'next/server';
import { db } from '@/db';
import { scenes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);

    const list = await db.select().from(scenes).where(eq(scenes.projectId, projectId));
    list.sort((a, b) => a.order - b.order);
    const mapped = list.map((s) => ({
      id: s.id,
      project_id: s.projectId,
      title: s.title,
      summary: s.summary || '',
      order: s.order,
      location_id: s.locationId || undefined,
      canon_status: s.canonStatus || 'draft',
      version: s.version || 1,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }));
    return NextResponse.json({ ok: true, data: mapped });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
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
      if (existing) {
        await tx.update(scenes).set(values).where(eq(scenes.id, sceneId));
      } else {
        await tx.insert(scenes).values(values);
      }
      await logVersion(tx, {
        projectId,
        action,
        entityType: 'scene',
        entityId: sceneId,
        changeData: values,
      });
    });

    const [s] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);

    return NextResponse.json({
      ok: true,
      data: {
        id: s.id,
        project_id: s.projectId,
        title: s.title,
        summary: s.summary || '',
        order: s.order,
        location_id: s.locationId || undefined,
        canon_status: s.canonStatus || 'draft',
        version: s.version || 1,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
