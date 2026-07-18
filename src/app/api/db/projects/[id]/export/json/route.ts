import { NextResponse } from 'next/server';
import { db } from '@/db';
import { loadProjectCanonDataset } from '@/lib/canon-scan-service';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedProject(id, userId);

    const dataset = await loadProjectCanonDataset(id);
    if (!dataset) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    const jsonString = JSON.stringify(dataset, null, 2);
    const safeName = dataset.project.name.replace(/[^\w\-. ]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_export.json`;

    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'JSON export failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
