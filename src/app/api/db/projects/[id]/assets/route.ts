import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);

    const list = await db.select().from(assets).where(eq(assets.projectId, projectId));
    const mapped = list.map((a) => ({
      id: a.id,
      project_id: a.projectId,
      name: a.name,
      file_size: a.fileSize,
      mime_type: a.mimeType,
      storage_provider: a.storageProvider,
      created_at: a.createdAt.toISOString(),
      updated_at: a.updatedAt.toISOString(),
      serve_url: `/api/db/assets/${a.id}/serve`,
    }));
    return NextResponse.json({ ok: true, data: mapped });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
