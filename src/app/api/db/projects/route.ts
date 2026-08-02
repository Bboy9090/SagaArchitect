import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';
import { requireUser } from '@/lib/auth-helpers';
import { apiSuccess } from '@/lib/api-response';
import { DependencyUnavailableError, ValidationError } from '@/lib/api-errors';
import { assertFeatureEnabled } from '@/lib/feature-flags';
import { NORMAL_MUTATION_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { executeIdempotentMutation, readIdempotencyKey } from '@/lib/idempotency';
import { withApiContext } from '@/lib/with-api-context';
import { normalizePublishingMetadata } from '@/lib/publishing-metadata';

interface ProjectPayload {
  id?: unknown;
  name?: unknown;
  concept?: unknown;
  genre?: unknown;
  tone?: unknown;
  era?: unknown;
  tech_level?: unknown;
  magic_system?: unknown;
  world_overview?: unknown;
  creation_myth?: unknown;
  themes?: unknown;
  current_conflict?: unknown;
  prophecy_hooks?: unknown;
  version?: unknown;
  publishing_metadata?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mapProject(p: typeof projects.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    concept: p.concept || '',
    genre: p.genre || '',
    tone: p.tone || '',
    era: p.era || '',
    tech_level: p.techLevel || '',
    magic_system: p.magicSystem || '',
    world_overview: p.worldOverview || '',
    creation_myth: p.creationMyth || '',
    themes: p.themes || [],
    current_conflict: p.currentConflict || '',
    prophecy_hooks: p.prophecyHooks || [],
    publishing_metadata: normalizePublishingMetadata(p.publishingMetadata),
    version: p.version || 1,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export const GET = withApiContext(async (_request, context) => {
  if (!db) throw new DependencyUnavailableError('Database service is unavailable.');
  const userId = await requireUser();
  context.userId = userId;
  const list = await db.select().from(projects).where(eq(projects.ownerId, userId));
  return apiSuccess(list.map(mapProject), context.requestId);
});

export const POST = withApiContext(async (req, context) => {
  assertFeatureEnabled('projectCreation');
  if (!db) throw new DependencyUnavailableError('Database service is unavailable.');
  const userId = await requireUser();
  context.userId = userId;
  const payload = await readJsonBodyWithLimit<ProjectPayload>(req, { policy: NORMAL_MUTATION_BODY });

  const requestedId = typeof payload.id === 'string' ? payload.id : undefined;
  const id = requestedId || crypto.randomUUID();
  const name = text(payload.name) || 'Untitled Project';
  if (name.length > 200) throw new ValidationError('Project name must be 200 characters or fewer.');

  const values = {
    id,
    ownerId: userId,
    name,
    concept: text(payload.concept),
    genre: text(payload.genre),
    tone: text(payload.tone),
    era: text(payload.era),
    techLevel: text(payload.tech_level),
    magicSystem: text(payload.magic_system),
    worldOverview: text(payload.world_overview),
    creationMyth: text(payload.creation_myth),
    themes: stringArray(payload.themes),
    currentConflict: text(payload.current_conflict),
    prophecyHooks: stringArray(payload.prophecy_hooks),
    publishingMetadata: normalizePublishingMetadata(payload.publishing_metadata),
    version: typeof payload.version === 'number' && Number.isInteger(payload.version) ? payload.version : 1,
  };

  const idempotencyKey = readIdempotencyKey(req);
  if (idempotencyKey) {
    const result = await executeIdempotentMutation(db, {
      userId,
      route: '/api/db/projects',
      key: idempotencyKey,
      requestBody: values,
    }, async (tx) => {
      const [inserted] = await tx.insert(projects).values(values).returning();
      await logVersion(tx, {
        projectId: id,
        userId,
        action: 'create',
        entityType: 'project',
        entityId: id,
        changeData: values,
      });
      return { status: 201, body: mapProject(inserted) };
    });

    const response = apiSuccess(result.body, context.requestId, result.status);
    response.headers.set('idempotency-replayed', String(result.replayed));
    return response;
  }

  let inserted: typeof projects.$inferSelect | undefined;
  await db.transaction(async (tx) => {
    [inserted] = await tx.insert(projects).values(values).returning();
    await logVersion(tx, {
      projectId: id,
      userId,
      action: 'create',
      entityType: 'project',
      entityId: id,
      changeData: values,
    });
  });

  if (!inserted) throw new DependencyUnavailableError('Created project could not be loaded.');
  return apiSuccess(mapProject(inserted), context.requestId, 201);
});

export const dynamic = 'force-dynamic';
