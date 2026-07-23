import { NextResponse } from 'next/server';
import { db } from '@/db';
import { versionHistory } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id: projectId } = await params;
    const userId = await requireUser();
    await requireOwnedProject(projectId, userId);

    const rows = await db
      .select()
      .from(versionHistory)
      .where(eq(versionHistory.projectId, projectId))
      .orderBy(desc(versionHistory.createdAt));

    const mapped = rows.map((r) => ({
      id: r.id,
      project_id: r.projectId,
      user_id: r.userId,
      action: r.action,
      entity_type: r.entityType,
      entity_id: r.entityId,
      change_data: r.changeData,
      created_at: r.createdAt.toISOString(),
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
