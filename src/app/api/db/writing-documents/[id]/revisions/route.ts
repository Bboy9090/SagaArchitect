import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { writingDocumentRevisions } from '@/db/schema';
import { AuthError, requireOwnedWritingDocument, requireUser } from '@/lib/auth-helpers';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedWritingDocument(id, userId);
    const revisions = await db.select().from(writingDocumentRevisions).where(eq(writingDocumentRevisions.documentId, id)).orderBy(desc(writingDocumentRevisions.createdAt)).limit(50);
    return NextResponse.json({ ok: true, data: revisions.map(revision => ({
      id: revision.id, document_id: revision.documentId, version: revision.version,
      title: revision.title, content: revision.content, status: revision.status,
      created_at: revision.createdAt.toISOString(),
    })) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Database error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
