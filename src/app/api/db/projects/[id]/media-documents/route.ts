import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { mediaDocuments } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import type { PhoenixMediaDocument, PhoenixMediaDocumentKind } from '@/lib/media-composition';

const MAX_MEDIA_DOCUMENT_BYTES = 12 * 1024 * 1024;
const KINDS = new Set<PhoenixMediaDocumentKind>(['image', 'design', 'illustration', 'comic_page', 'video_frame']);

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : 'Database error';
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

function validKind(value: unknown): value is PhoenixMediaDocumentKind {
  return typeof value === 'string' && KINDS.has(value as PhoenixMediaDocumentKind);
}

function validDocument(value: unknown, projectId: string, kind: PhoenixMediaDocumentKind): value is PhoenixMediaDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<PhoenixMediaDocument>;
  return doc.projectId === projectId
    && doc.kind === kind
    && typeof doc.id === 'string'
    && doc.id.length > 0
    && doc.id.length <= 128
    && typeof doc.title === 'string'
    && doc.title.length <= 255
    && Number.isFinite(doc.width)
    && Number.isFinite(doc.height)
    && Number(doc.width) >= 1
    && Number(doc.width) <= 16384
    && Number(doc.height) >= 1
    && Number(doc.height) <= 16384
    && Array.isArray(doc.layers)
    && doc.layers.length <= 500;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const kind = new URL(request.url).searchParams.get('kind');
    if (!validKind(kind)) return NextResponse.json({ ok: false, error: 'Unsupported media document kind.' }, { status: 400 });
    const [row] = await db.select().from(mediaDocuments)
      .where(and(eq(mediaDocuments.projectId, projectId), eq(mediaDocuments.kind, kind))).limit(1);
    if (!row) return NextResponse.json({ ok: true, data: null });
    return NextResponse.json({ ok: true, data: { ...row.document, version: row.version, updatedAt: row.updatedAt.toISOString() } });
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
    if (declaredLength > MAX_MEDIA_DOCUMENT_BYTES) return NextResponse.json({ ok: false, error: 'Media document is too large.' }, { status: 413 });
    const payload = await request.json() as { kind?: unknown; document?: unknown };
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    if (bytes > MAX_MEDIA_DOCUMENT_BYTES) return NextResponse.json({ ok: false, error: 'Media document is too large.' }, { status: 413 });
    if (!validKind(payload.kind)) return NextResponse.json({ ok: false, error: 'Unsupported media document kind.' }, { status: 400 });
    if (!validDocument(payload.document, projectId, payload.kind)) return NextResponse.json({ ok: false, error: 'Invalid media document.' }, { status: 400 });

    const [existing] = await db.select().from(mediaDocuments)
      .where(and(eq(mediaDocuments.projectId, projectId), eq(mediaDocuments.kind, payload.kind))).limit(1);
    const requestedVersion = Number((payload.document as PhoenixMediaDocument).version || 1);
    if (existing && requestedVersion !== existing.version) {
      return NextResponse.json({
        ok: false,
        error: 'This media document changed on another device. Reload it before saving.',
        code: 'VERSION_CONFLICT',
        server_version: existing.version,
      }, { status: 409 });
    }

    const nextVersion = existing ? existing.version + 1 : 1;
    const now = new Date();
    const stored = {
      ...(payload.document as PhoenixMediaDocument),
      version: nextVersion,
      updatedAt: now.toISOString(),
    };

    if (existing) {
      const [updated] = await db.update(mediaDocuments).set({
        document: stored,
        version: nextVersion,
        updatedAt: now,
      }).where(and(eq(mediaDocuments.id, existing.id), eq(mediaDocuments.version, existing.version))).returning();
      if (!updated) return NextResponse.json({ ok: false, error: 'Media document version conflict.' }, { status: 409 });
    } else {
      await db.insert(mediaDocuments).values({
        projectId,
        kind: payload.kind,
        document: stored,
        version: nextVersion,
        updatedAt: now,
      });
    }
    return NextResponse.json({ ok: true, data: stored });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
