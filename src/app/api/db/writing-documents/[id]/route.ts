import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { writingDocuments } from '@/db/schema';
import { AuthError, requireOwnedWritingDocument, requireUser } from '@/lib/auth-helpers';
import { logVersion } from '@/lib/version-history';
import { collectDocumentDescendantIds } from '@/lib/writing-sync';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    const document = await requireOwnedWritingDocument(id, userId);
    const projectDocuments = await db.select().from(writingDocuments).where(eq(writingDocuments.projectId, document.projectId));
    const descendants = collectDocumentDescendantIds(projectDocuments, id);
    await db.transaction(async tx => {
      await logVersion(tx, { projectId: document.projectId, userId, action: 'delete', entityType: 'writing_document', entityId: id, changeData: { title: document.title } });
      await tx.delete(writingDocuments).where(inArray(writingDocuments.id, descendants));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
