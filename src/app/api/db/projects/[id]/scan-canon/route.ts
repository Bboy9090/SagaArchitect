import { NextResponse } from 'next/server';
import { db } from '@/db';
import { scanProject } from '@/lib/canon-scan-service';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedProject(id, userId);

    const result = await scanProject(id);
    if (!result) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Canon scan failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
