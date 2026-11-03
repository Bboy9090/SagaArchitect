import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { studioDocuments, versionHistory } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import {
  isPhoenixStudioDocumentKind,
  validatePhoenixStudioDocument,
  type PhoenixStudioDocument,
} from '@/lib/studio-document';

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Studio restore error' }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const payload = await request.json() as { history_id?: unknown; kind?: unknown; expected_version?: unknown };
    if (typeof payload.history_id !== 'string') return NextResponse.json({ ok: false, error: 'history_id is required.' }, { status: 400 });
    if (!isPhoenixStudioDocumentKind(payload.kind)) return NextResponse.json({ ok: false, error: 'Unsupported studio document kind.' }, { status: 400 });
    const expectedVersion = Number(payload.expected_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json({ ok: false, error: 'expected_version is required.' }, { status: 400 });

    const [studio] = await db.select().from(studioDocuments)
      .where(and(eq(studioDocuments.projectId, projectId), eq(studioDocuments.kind, payload.kind))).limit(1);
    if (!studio) return NextResponse.json({ ok: false, error: 'Studio timeline not found.' }, { status: 404 });
    if (studio.version !== expectedVersion) {
      return NextResponse.json({
        ok: false,
        error: 'Studio timeline changed before restore. Reload history and try again.',
        code: 'VERSION_CONFLICT',
        server_version: studio.version,
      }, { status: 409 });
    }

    const [history] = await db.select().from(versionHistory)
      .where(and(
        eq(versionHistory.id, payload.history_id),
        eq(versionHistory.projectId, projectId),
        eq(versionHistory.entityType, 'studio_document'),
        eq(versionHistory.entityId, studio.id),
      )).limit(1);
    if (!history) return NextResponse.json({ ok: false, error: 'Studio snapshot not found.' }, { status: 404 });

    const change = history.changeData as Record<string, unknown>;
    const snapshot = change.document;
    if (!validatePhoenixStudioDocument(payload.kind, snapshot, projectId)) {
      return NextResponse.json({ ok: false, error: 'Snapshot payload is invalid.' }, { status: 400 });
    }

    const now = new Date();
    const nextVersion = studio.version + 1;
    const restored: PhoenixStudioDocument = {
      ...(structuredClone(snapshot) as PhoenixStudioDocument),
      projectId,
      updatedAt: now.toISOString(),
    };

    await db.transaction(async tx => {
      await tx.insert(versionHistory).values({
        projectId,
        userId,
        action: 'update',
        entityType: 'studio_document',
        entityId: studio.id,
        changeData: {
          kind: payload.kind,
          version: studio.version,
          label: 'Before restore',
          reason: 'pre_restore_backup',
          document: studio.document,
        },
      });
      const [updated] = await tx.update(studioDocuments).set({
        document: restored,
        version: nextVersion,
        updatedAt: now,
      }).where(and(eq(studioDocuments.id, studio.id), eq(studioDocuments.version, expectedVersion))).returning();
      if (!updated) throw new Error('Studio timeline version conflict.');

      await tx.insert(versionHistory).values({
        projectId,
        userId,
        action: 'restore',
        entityType: 'studio_document',
        entityId: studio.id,
        changeData: {
          kind: payload.kind,
          version: nextVersion,
          label: typeof change.label === 'string' ? `Restored: ${change.label}` : 'Restored snapshot',
          reason: 'restore',
          restoredFromHistoryId: history.id,
          document: restored,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      data: { document: restored, version: nextVersion, updatedAt: now.toISOString() },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
