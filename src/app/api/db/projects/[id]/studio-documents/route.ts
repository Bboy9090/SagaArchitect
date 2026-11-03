import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { studioDocuments } from '@/db/schema';
import { AuthError, requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import {
  isPhoenixStudioDocumentKind,
  validatePhoenixStudioDocument,
  type PhoenixStudioDocument,
} from '@/lib/studio-document';

const MAX_STUDIO_DOCUMENT_BYTES = 8 * 1024 * 1024;

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Studio document error' }, { status: 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);
    const kind = new URL(request.url).searchParams.get('kind');
    if (!isPhoenixStudioDocumentKind(kind)) return NextResponse.json({ ok: false, error: 'Unsupported studio document kind.' }, { status: 400 });

    const [row] = await db.select().from(studioDocuments)
      .where(and(eq(studioDocuments.projectId, projectId), eq(studioDocuments.kind, kind))).limit(1);
    return NextResponse.json({
      ok: true,
      data: row ? {
        document: row.document,
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
      } : null,
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
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_STUDIO_DOCUMENT_BYTES) return NextResponse.json({ ok: false, error: 'Studio document is too large.' }, { status: 413 });

    const payload = await request.json() as { kind?: unknown; document?: unknown; expected_version?: unknown };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    if (payloadBytes > MAX_STUDIO_DOCUMENT_BYTES) return NextResponse.json({ ok: false, error: 'Studio document is too large.' }, { status: 413 });
    if (!isPhoenixStudioDocumentKind(payload.kind)) return NextResponse.json({ ok: false, error: 'Unsupported studio document kind.' }, { status: 400 });
    if (!validatePhoenixStudioDocument(payload.kind, payload.document, projectId)) {
      return NextResponse.json({ ok: false, error: 'Invalid studio document.' }, { status: 400 });
    }

    const expectedVersion = Number(payload.expected_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      return NextResponse.json({ ok: false, error: 'expected_version must be a non-negative integer.' }, { status: 400 });
    }

    const [existing] = await db.select().from(studioDocuments)
      .where(and(eq(studioDocuments.projectId, projectId), eq(studioDocuments.kind, payload.kind))).limit(1);
    if (existing && expectedVersion !== existing.version) {
      return NextResponse.json({
        ok: false,
        error: 'This studio timeline changed on another device. Reload before saving.',
        code: 'VERSION_CONFLICT',
        server_version: existing.version,
      }, { status: 409 });
    }
    if (!existing && expectedVersion !== 0) {
      return NextResponse.json({ ok: false, error: 'Studio timeline does not exist at the expected version.' }, { status: 409 });
    }

    const now = new Date();
    const nextVersion = existing ? existing.version + 1 : 1;
    const document: PhoenixStudioDocument = {
      ...(payload.document as PhoenixStudioDocument),
      projectId,
      updatedAt: now.toISOString(),
    };

    if (existing) {
      const [updated] = await db.update(studioDocuments).set({
        document,
        version: nextVersion,
        updatedAt: now,
      }).where(and(eq(studioDocuments.id, existing.id), eq(studioDocuments.version, existing.version))).returning();
      if (!updated) return NextResponse.json({ ok: false, error: 'Studio timeline version conflict.' }, { status: 409 });
    } else {
      await db.insert(studioDocuments).values({
        projectId,
        kind: payload.kind,
        document,
        version: nextVersion,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      ok: true,
      data: { document, version: nextVersion, updatedAt: now.toISOString() },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
