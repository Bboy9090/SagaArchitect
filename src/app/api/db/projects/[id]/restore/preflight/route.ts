import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireOwnedProject, requireUser, AuthError } from '@/lib/auth-helpers';
import { LARGE_MIGRATION_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { recordLifecycleEvent } from '@/lib/data-lifecycle';
import { validateProjectBackup } from '@/lib/project-backup';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });

  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedProject(id, userId);
    const backup = await readJsonBodyWithLimit<unknown>(request, { policy: LARGE_MIGRATION_BODY });
    const report = validateProjectBackup(backup, { expectedProjectId: id });

    let receiptId = '';
    await db.transaction(async tx => {
      receiptId = await recordLifecycleEvent(tx, {
        actorUserId: userId,
        subjectUserId: userId,
        projectId: id,
        operation: 'project_restore_preflight',
        status: report.valid ? 'completed' : 'failed',
        details: {
          valid: report.valid,
          errors: report.errors,
          warnings: report.warnings,
          entityCounts: report.entityCounts,
        },
      });
    });

    return NextResponse.json(
      { ok: report.valid, data: { ...report, receiptId }, error: report.valid ? undefined : 'Backup restore preflight failed.' },
      { status: report.valid ? 200 : 400 },
    );
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Restore preflight failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
