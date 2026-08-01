import { NextResponse } from 'next/server';
import { db } from '@/db';
import { scenes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedScene, AuthError } from '@/lib/auth-helpers';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    const existing = await requireOwnedScene(id, userId);

    await db.transaction(async (tx) => {
      await logVersion(tx, {
        projectId: existing.projectId,
        userId,
        action: 'delete',
        entityType: 'scene',
        entityId: id,
        changeData: { title: existing.title },
      });
      await tx.delete(scenes).where(eq(scenes.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
