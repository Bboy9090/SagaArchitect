import { NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedProject, AuthError } from '@/lib/auth-helpers';
import { ConflictError, DependencyUnavailableError, ValidationError } from '@/lib/api-errors';
import { assertFeatureEnabled } from '@/lib/feature-flags';
import { NORMAL_MUTATION_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { expectedVersionFromRequest, versionEtag } from '@/lib/optimistic-concurrency';
import { recordLifecycleEvent } from '@/lib/data-lifecycle';
import { normalizePublishingMetadata } from '@/lib/publishing-metadata';

function projectResponse(p: typeof projects.$inferSelect) {
  return {
    id: p.id, name: p.name, concept: p.concept || '', genre: p.genre || '', tone: p.tone || '', era: p.era || '',
    tech_level: p.techLevel || '', magic_system: p.magicSystem || '', world_overview: p.worldOverview || '',
    creation_myth: p.creationMyth || '', themes: p.themes || [], current_conflict: p.currentConflict || '',
    prophecy_hooks: p.prophecyHooks || [], publishing_metadata: normalizePublishingMetadata(p.publishingMetadata),
    version: p.version || 1, created_at: p.createdAt.toISOString(), updated_at: p.updatedAt.toISOString(),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    const project = await requireOwnedProject(id, userId);
    const response = NextResponse.json({ ok: true, data: projectResponse(project) });
    response.headers.set('etag', versionEtag(project.version));
    return response;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedProject(id, userId);
    const payload = await readJsonBodyWithLimit<Record<string, unknown>>(req, { policy: NORMAL_MUTATION_BODY });
    const expectedVersion = expectedVersionFromRequest(req, payload);

    const updates: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
    const fields = {
      name: 'name', concept: 'concept', genre: 'genre', tone: 'tone', era: 'era', tech_level: 'techLevel',
      magic_system: 'magicSystem', world_overview: 'worldOverview', creation_myth: 'creationMyth', themes: 'themes',
      current_conflict: 'currentConflict', prophecy_hooks: 'prophecyHooks',
    } as const;
    for (const [input, column] of Object.entries(fields)) {
      if (payload[input] !== undefined) (updates as Record<string, unknown>)[column] = payload[input];
    }
    if (payload.publishing_metadata !== undefined) updates.publishingMetadata = normalizePublishingMetadata(payload.publishing_metadata);

    let updatedProject: typeof projects.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      [updatedProject] = await tx
        .update(projects)
        .set({ ...updates, version: sql<number>`${projects.version} + 1` })
        .where(and(eq(projects.id, id), eq(projects.ownerId, userId), eq(projects.version, expectedVersion)))
        .returning();

      if (!updatedProject) {
        const [current] = await tx
          .select({ version: projects.version })
          .from(projects)
          .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
          .limit(1);
        throw new ConflictError(
          current
            ? `Project version conflict. Expected ${expectedVersion}; current version is ${current.version}. Reload before saving.`
            : 'The project no longer exists.',
        );
      }

      await logVersion(tx, {
        projectId: id,
        userId,
        action: 'update',
        entityType: 'project',
        entityId: id,
        changeData: { ...updates, previousVersion: expectedVersion, version: updatedProject.version },
      });
    });

    if (!updatedProject) throw new DependencyUnavailableError('Updated project could not be loaded.');
    const response = NextResponse.json({ ok: true, data: projectResponse(updatedProject) });
    response.headers.set('etag', versionEtag(updatedProject.version));
    return response;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof ConflictError || error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    assertFeatureEnabled('projectDeletion');
    const { id } = await params;
    const userId = await requireUser();
    const existing = await requireOwnedProject(id, userId);
    if (req.headers.get('x-confirm-project-id') !== id) {
      throw new ValidationError('Project deletion requires X-Confirm-Project-Id to match the project ID.');
    }

    let receiptId = '';
    await db.transaction(async (tx) => {
      receiptId = await recordLifecycleEvent(tx, {
        actorUserId: userId,
        subjectUserId: userId,
        projectId: id,
        operation: 'project_delete',
        status: 'completed',
        details: {
          projectName: existing.name,
          confirmation: 'project-id-header',
          retainedData: ['data_lifecycle_events'],
        },
      });
      await logVersion(tx, {
        projectId: id,
        userId,
        action: 'delete',
        entityType: 'project',
        entityId: id,
        changeData: { name: existing.name, lifecycleReceiptId: receiptId },
      });
      await tx.delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, userId)));
    });
    return NextResponse.json({ ok: true, data: { receiptId } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
