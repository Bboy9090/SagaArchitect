import { NextResponse } from 'next/server';
import { db } from '@/db';
import { characters } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    await db.delete(characters).where(eq(characters.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
