import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { mediaDocuments, versionHistory } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import type { PhoenixMediaDocument, PhoenixMediaDocumentKind } from '@/lib/media-composition';

const KINDS = new Set<PhoenixMediaDocumentKind>(['image', 'design', 'illustration', 'comic_page', 'video_frame']);

function validKind(value: unknown): value is PhoenixMediaDocumentKind {
  return typeof value === 'string' && (KINDS.has(value as PhoenixMediaDocumentKind) || /^comic_page:[A-Za-z0-9_-]{1,64}$/.test(value));
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Media restore error' }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const payload = await request.json() as { history_id?: unknown; kind?: unknown; expected_version?: unknown };
    if (typeof payload.history_id !== 'string') return NextResponse.json({ ok: false, error: 'history_id is required.' }, { status: 400 });
    if (!validKind(payload.kind)) return NextResponse.json({ ok: false, error: 'Unsupported media document kind.' }, { status: 400 });
    const expectedVersion = Number(payload.expected_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json({ ok: false, error: 'expected_version is required.' }, { status: 400 });

    const [media] = await db.select().from(mediaDocuments)
      .where(and(eq(mediaDocuments.projectId, projectId), eq(mediaDocuments.kind, payload.kind))).limit(1);
    if (!media) return NextResponse.json({ ok: false, error: 'Media document not found.' }, { status: 404 });
    if (media.version !== expectedVersion) {
      return NextResponse.json({ ok: false, error: 'Media document changed before restore. Reload history and try again.', code: 'VERSION_CONFLICT', server_version: media.version }, { status: 409 });
    }

    const [history] = await db.select().from(versionHistory)
      .where(and(
        eq(versionHistory.id, payload.history_id),
        eq(versionHistory.projectId, projectId),
        eq(versionHistory.entityType, 'media_document'),
        eq(versionHistory.entityId, media.id),
      )).limit(1);
    if (!history) return NextResponse.json({ ok: false, error: 'Media snapshot not found.' }, { status: 404 });

    const change = history.changeData as Record<string, unknown>;
    const snapshot = change.document as PhoenixMediaDocument | undefined;
    if (!snapshot || snapshot.kind !== payload.kind || !Array.isArray(snapshot.layers)) {
      return NextResponse.json({ ok: false, error: 'Snapshot payload is invalid.' }, { status: 400 });
    }

    const now = new Date();
    const nextVersion = media.version + 1;
    const restored: PhoenixMediaDocument = {
      ...structuredClone(snapshot),
      id: media.document.id,
      projectId,
      kind: payload.kind,
      version: nextVersion,
      updatedAt: now.toISOString(),
    };

    await db.transaction(async tx => {
      await tx.insert(versionHistory).values({
        projectId,
        userId,
        action: 'update',
        entityType: 'media_document',
        entityId: media.id,
        changeData: {
          kind: payload.kind,
          version: media.version,
          label: 'Before restore',
          reason: 'pre_restore_backup',
          document: media.document,
        },
      });
      const [updated] = await tx.update(mediaDocuments).set({
        document: restored,
        version: nextVersion,
        updatedAt: now,
      }).where(and(eq(mediaDocuments.id, media.id), eq(mediaDocuments.version, expectedVersion))).returning();
      if (!updated) throw new Error('Media document version conflict.');
      await tx.insert(versionHistory).values({
        projectId,
        userId,
        action: 'restore',
        entityType: 'media_document',
        entityId: media.id,
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

    return NextResponse.json({ ok: true, data: restored });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
