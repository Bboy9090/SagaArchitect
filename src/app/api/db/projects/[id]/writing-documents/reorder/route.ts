import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { writingDocuments } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import { logVersion } from '@/lib/version-history';
import { OutlineValidationError, validateWritingOutlineChanges } from '@/lib/writing-outline';

const MAX_DOCUMENTS = 1000;
const MAX_BODY_BYTES = 256 * 1024;

function present(document: typeof writingDocuments.$inferSelect) {
  return {
    id: document.id, project_id: document.projectId, parent_id: document.parentId || undefined,
    title: document.title, kind: document.kind, status: document.status, content: document.content,
    order: document.order, word_target: document.wordTarget || undefined, version: document.version,
    created_at: document.createdAt.toISOString(), updated_at: document.updatedAt.toISOString(),
  };
}

function errorResponse(error: unknown) {
  if (error instanceof OutlineValidationError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Database error' }, { status: 500 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: 'Outline payload is too large.' }, { status: 413 });
    const payload: unknown = await request.json();
    if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: 'Outline payload is too large.' }, { status: 413 });
    const existing = await db.select().from(writingDocuments).where(eq(writingDocuments.projectId, projectId));
    if (existing.length > MAX_DOCUMENTS) return NextResponse.json({ ok: false, error: 'Outline contains too many documents.' }, { status: 409 });
    const byId = new Map(existing.map(document => [document.id, document]));
    const changes = validateWritingOutlineChanges(existing, payload);

    await db.transaction(async tx => {
      for (const change of changes) {
        const document = byId.get(change.id)!;
        const [updated] = await tx.update(writingDocuments).set({ parentId: change.parentId, order: change.order, version: document.version + 1, updatedAt: new Date() })
          .where(and(eq(writingDocuments.id, document.id), eq(writingDocuments.version, document.version))).returning({ id: writingDocuments.id });
        if (!updated) throw new AuthError(409, 'This outline changed on another device. Reload it before saving.');
      }
      await logVersion(tx, { projectId, userId, action: 'update', entityType: 'writing_outline', entityId: projectId, changeData: { operation: 'reorder', document_count: changes.length } });
    });
    const saved = await db.select().from(writingDocuments).where(eq(writingDocuments.projectId, projectId));
    saved.sort((a, b) => a.order - b.order);
    return NextResponse.json({ ok: true, data: saved.map(present) });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
