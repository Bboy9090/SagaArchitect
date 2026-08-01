import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { writingDocuments } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import { logVersion } from '@/lib/version-history';
import { isWritingDocumentKind, isWritingDocumentStatus } from '@/lib/writing-sync';
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

function present(document: typeof writingDocuments.$inferSelect) {
  return {
    id: document.id,
    project_id: document.projectId,
    parent_id: document.parentId || undefined,
    title: document.title,
    kind: document.kind,
    status: document.status,
    content: document.content,
    order: document.order,
    word_target: document.wordTarget || undefined,
    created_at: document.createdAt.toISOString(),
    updated_at: document.updatedAt.toISOString(),
  };
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : 'Database error';
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const documents = await db.select().from(writingDocuments).where(eq(writingDocuments.projectId, projectId));
    documents.sort((a, b) => a.order - b.order);
    return NextResponse.json({ ok: true, data: documents.map(present) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_CONTENT_BYTES) return NextResponse.json({ ok: false, error: 'Document payload is too large.' }, { status: 413 });
    const payload = await request.json();
    const encodedSize = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    if (encodedSize > MAX_CONTENT_BYTES) return NextResponse.json({ ok: false, error: 'Document payload is too large.' }, { status: 413 });

    const id = typeof payload.id === 'string' ? payload.id : crypto.randomUUID();
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 255) : '';
    const kind = isWritingDocumentKind(payload.kind) ? payload.kind : 'chapter';
    const status = isWritingDocumentStatus(payload.status) ? payload.status : 'outline';
    if (!title) return NextResponse.json({ ok: false, error: 'Document title is required.' }, { status: 400 });

    const [existing] = await db.select().from(writingDocuments).where(eq(writingDocuments.id, id)).limit(1);
    if (existing && existing.projectId !== projectId) return NextResponse.json({ ok: false, error: 'Document project mismatch.' }, { status: 400 });

    const parentId = typeof payload.parent_id === 'string' ? payload.parent_id : null;
    if (parentId) {
      if (parentId === id) return NextResponse.json({ ok: false, error: 'A document cannot contain itself.' }, { status: 400 });
      const [parent] = await db.select().from(writingDocuments).where(and(eq(writingDocuments.id, parentId), eq(writingDocuments.projectId, projectId))).limit(1);
      if (!parent) return NextResponse.json({ ok: false, error: 'Parent document not found in this project.' }, { status: 400 });
    }

    const values = {
      id,
      projectId,
      parentId,
      title,
      kind,
      status,
      content: typeof payload.content === 'string' ? payload.content : '',
      order: Number.isInteger(payload.order) && payload.order >= 0 ? payload.order : 0,
      wordTarget: Number.isInteger(payload.word_target) && payload.word_target > 0 ? payload.word_target : null,
      version: (existing?.version || 0) + 1,
      updatedAt: new Date(),
    };

    await db.transaction(async tx => {
      if (existing) await tx.update(writingDocuments).set(values).where(eq(writingDocuments.id, id));
      else await tx.insert(writingDocuments).values(values);
      await logVersion(tx, { projectId, userId, action: existing ? 'update' : 'create', entityType: 'writing_document', entityId: id, changeData: { ...values, content: `[${values.content.length} characters]` } });
    });
    const [saved] = await db.select().from(writingDocuments).where(eq(writingDocuments.id, id)).limit(1);
    return NextResponse.json({ ok: true, data: present(saved) });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
