import { NextResponse } from 'next/server';
import { db } from '@/db';
import { characters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });

  try {
    const userId = await requireUser();
    const { id } = await params;
    const [existing] = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: 'Character not found' }, { status: 404 });
    await requireOwnedProject(existing.projectId, userId);

    await db.transaction(async (tx) => {
      await logVersion(tx, {
        projectId: existing.projectId,
        userId,
        action: 'delete',
        entityType: 'character',
        entityId: id,
        changeData: { name: existing.name },
      });
      await tx.delete(characters).where(eq(characters.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
