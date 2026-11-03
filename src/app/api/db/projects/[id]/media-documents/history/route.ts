import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { mediaDocuments, versionHistory } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import type { PhoenixMediaDocumentKind } from '@/lib/media-composition';

const KINDS = new Set<PhoenixMediaDocumentKind>(['image', 'design', 'illustration', 'comic_page', 'video_frame']);

function validKind(value: unknown): value is PhoenixMediaDocumentKind {
  return typeof value === 'string' && (KINDS.has(value as PhoenixMediaDocumentKind) || /^comic_page:[A-Za-z0-9_-]{1,64}$/.test(value));
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Media history error' }, { status: 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const kind = new URL(request.url).searchParams.get('kind');
    if (!validKind(kind)) return NextResponse.json({ ok: false, error: 'Unsupported media document kind.' }, { status: 400 });

    const [media] = await db.select({ id: mediaDocuments.id }).from(mediaDocuments)
      .where(and(eq(mediaDocuments.projectId, projectId), eq(mediaDocuments.kind, kind))).limit(1);
    if (!media) return NextResponse.json({ ok: true, data: [] });

    const rows = await db.select().from(versionHistory)
      .where(and(
        eq(versionHistory.projectId, projectId),
        eq(versionHistory.entityType, 'media_document'),
        eq(versionHistory.entityId, media.id),
      ))
      .orderBy(desc(versionHistory.createdAt))
      .limit(50);

    return NextResponse.json({
      ok: true,
      data: rows.map(row => {
        const change = row.changeData as Record<string, unknown>;
        return {
          id: row.id,
          action: row.action,
          version: Number(change.version || 1),
          label: typeof change.label === 'string' ? change.label : null,
          reason: typeof change.reason === 'string' ? change.reason : null,
          created_at: row.createdAt.toISOString(),
        };
      }),
    });
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
    const payload = await request.json() as { kind?: unknown; label?: unknown };
    if (!validKind(payload.kind)) return NextResponse.json({ ok: false, error: 'Unsupported media document kind.' }, { status: 400 });
    const label = typeof payload.label === 'string' ? payload.label.trim().slice(0, 120) : '';

    const [media] = await db.select().from(mediaDocuments)
      .where(and(eq(mediaDocuments.projectId, projectId), eq(mediaDocuments.kind, payload.kind))).limit(1);
    if (!media) return NextResponse.json({ ok: false, error: 'Media document not found.' }, { status: 404 });

    const [created] = await db.insert(versionHistory).values({
      projectId,
      userId,
      action: 'update',
      entityType: 'media_document',
      entityId: media.id,
      changeData: {
        kind: payload.kind,
        version: media.version,
        label: label || 'Manual snapshot',
        reason: 'manual_snapshot',
        document: media.document,
      },
    }).returning();

    return NextResponse.json({
      ok: true,
      data: {
        id: created.id,
        action: created.action,
        version: media.version,
        label: label || 'Manual snapshot',
        reason: 'manual_snapshot',
        created_at: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
