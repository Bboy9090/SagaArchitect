import { NextResponse } from 'next/server';
import { db } from '@/db';
import { generateProjectPdf, buildPdfFilename } from '@/lib/pdf-export-service';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';

// UUID v4 shape validation — guards against path traversal before any DB hit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const { id } = await params;

    // Validate ID shape before touching the DB
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid project ID' }, { status: 400 });
    }

    const userId = await requireUser();
    const projectRow = await requireOwnedProject(id, userId);

    const pdfBuffer = await generateProjectPdf(id);
    const filename = buildPdfFilename(projectRow.name);

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'PDF export failed';
    console.error('[export/pdf] Error:', error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Must be nodejs runtime — puppeteer-core requires Node.js APIs
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
