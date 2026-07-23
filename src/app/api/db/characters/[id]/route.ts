import { NextResponse } from 'next/server';
import { db } from '@/db';
import { characters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    const [existing] = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
    await db.transaction(async (tx) => {
      if (existing) {
        await logVersion(tx, {
          projectId: existing.projectId,
          action: 'delete',
          entityType: 'character',
          entityId: id,
          changeData: { name: existing.name },
        });
      }
      await tx.delete(characters).where(eq(characters.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
