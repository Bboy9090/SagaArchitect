import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { writingDocumentRevisions, writingDocuments } from '@/db/schema';
import { AuthError, requireOwnedWritingDocument, requireUser } from '@/lib/auth-helpers';
import { logVersion } from '@/lib/version-history';

function present(document: typeof writingDocuments.$inferSelect) {
  return {
    id: document.id, project_id: document.projectId, parent_id: document.parentId || undefined,
    title: document.title, kind: document.kind, status: document.status, content: document.content,
    order: document.order, word_target: document.wordTarget || undefined, version: document.version,
    created_at: document.createdAt.toISOString(), updated_at: document.updatedAt.toISOString(),
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    const document = await requireOwnedWritingDocument(id, userId);
    const payload = await request.json();
    if (typeof payload.revision_id !== 'string') return NextResponse.json({ ok: false, error: 'Revision id is required.' }, { status: 400 });
    const [revision] = await db.select().from(writingDocumentRevisions).where(and(eq(writingDocumentRevisions.id, payload.revision_id), eq(writingDocumentRevisions.documentId, id))).limit(1);
    if (!revision) return NextResponse.json({ ok: false, error: 'Revision not found.' }, { status: 404 });

    const nextVersion = document.version + 1;
    await db.transaction(async tx => {
      await tx.insert(writingDocumentRevisions).values({ documentId: id, userId, version: document.version, title: document.title, content: document.content, status: document.status });
      await tx.update(writingDocuments).set({ title: revision.title, content: revision.content, status: revision.status, version: nextVersion, updatedAt: new Date() }).where(eq(writingDocuments.id, id));
      await logVersion(tx, { projectId: document.projectId, userId, action: 'restore', entityType: 'writing_document', entityId: id, changeData: { restoredRevisionId: revision.id, restoredVersion: revision.version } });
    });
    const [restored] = await db.select().from(writingDocuments).where(eq(writingDocuments.id, id)).limit(1);
    return NextResponse.json({ ok: true, data: present(restored) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Database error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
