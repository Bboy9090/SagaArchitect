import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { studioDocuments, versionHistory } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import { isPhoenixStudioDocumentKind } from '@/lib/studio-document';

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Studio history error' }, { status: 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const kind = new URL(request.url).searchParams.get('kind');
    if (!isPhoenixStudioDocumentKind(kind)) return NextResponse.json({ ok: false, error: 'Unsupported studio document kind.' }, { status: 400 });

    const [studio] = await db.select({ id: studioDocuments.id }).from(studioDocuments)
      .where(and(eq(studioDocuments.projectId, projectId), eq(studioDocuments.kind, kind))).limit(1);
    if (!studio) return NextResponse.json({ ok: true, data: [] });

    const rows = await db.select().from(versionHistory)
      .where(and(
        eq(versionHistory.projectId, projectId),
        eq(versionHistory.entityType, 'studio_document'),
        eq(versionHistory.entityId, studio.id),
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
    if (!isPhoenixStudioDocumentKind(payload.kind)) return NextResponse.json({ ok: false, error: 'Unsupported studio document kind.' }, { status: 400 });
    const label = typeof payload.label === 'string' ? payload.label.trim().slice(0, 120) : '';

    const [studio] = await db.select().from(studioDocuments)
      .where(and(eq(studioDocuments.projectId, projectId), eq(studioDocuments.kind, payload.kind))).limit(1);
    if (!studio) return NextResponse.json({ ok: false, error: 'Studio document not found.' }, { status: 404 });

    const [created] = await db.insert(versionHistory).values({
      projectId,
      userId,
      action: 'update',
      entityType: 'studio_document',
      entityId: studio.id,
      changeData: {
        kind: payload.kind,
        version: studio.version,
        label: label || 'Manual snapshot',
        reason: 'manual_snapshot',
        document: studio.document,
      },
    }).returning();

    return NextResponse.json({
      ok: true,
      data: {
        id: created.id,
        action: created.action,
        version: studio.version,
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
