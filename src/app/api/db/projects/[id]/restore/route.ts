import { db } from '@/db';
import * as s from '@/db/schema';
import { requireOwnedProject, requireUser } from '@/lib/auth-helpers';
import { DependencyUnavailableError, ValidationError } from '@/lib/api-errors';
import { apiSuccess } from '@/lib/api-response';
import { recordLifecycleEvent } from '@/lib/data-lifecycle';
import { assertFeatureEnabled } from '@/lib/feature-flags';
import { BACKUP_RESTORE_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { executeIdempotentMutation, readIdempotencyKey } from '@/lib/idempotency';
import type { ProjectBackupWithAssetsPackage } from '@/lib/project-backup-assets';
import {
  assertRestoreConfirmation,
  buildProjectRestorePlan,
} from '@/lib/project-restore';
import { consumeRateLimit } from '@/lib/rate-limit/rate-limiter';
import { deleteAssetObject, saveAssetObject } from '@/lib/storage/asset-storage';
import type { StorageProviderName } from '@/lib/storage/storage-provider';
import { logVersion } from '@/lib/version-history';
import { withApiContext } from '@/lib/with-api-context';

interface StoredCleanupReference {
  provider: StorageProviderName;
  reference: string;
}

interface RestoreResponseBody {
  sourceProjectId: string;
  restoredProjectId: string;
  restoredProjectName: string;
  entityCounts: Record<string, number>;
  assetBytesRestored: number;
  lifecycleReceiptId: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApiContext(async (req, context) => {
    assertFeatureEnabled('projectRestore');
    if (!db) throw new DependencyUnavailableError('Database service is unavailable.');

    const userId = await requireUser();
    context.userId = userId;
    const { id: sourceProjectId } = await params;
    await requireOwnedProject(sourceProjectId, userId);
    assertRestoreConfirmation(req);
    await consumeRateLimit(req, 'restore', userId);

    const idempotencyKey = readIdempotencyKey(req);
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key is required for project restore.');
    }

    const backup = await readJsonBodyWithLimit<ProjectBackupWithAssetsPackage>(req, {
      policy: BACKUP_RESTORE_BODY,
    });
    const plan = buildProjectRestorePlan(backup, {
      userId,
      expectedSourceProjectId: sourceProjectId,
    });

    const createdStorageObjects: StoredCleanupReference[] = [];
    let result;
    try {
      result = await executeIdempotentMutation<RestoreResponseBody>(db, {
        userId,
        route: `/api/db/projects/${sourceProjectId}/restore`,
        key: idempotencyKey,
        requestBody: {
          sourceProjectId,
          payloadSha256: backup.manifest.payloadSha256,
          assetsSha256: backup.manifest.assetsSha256,
          assetCount: backup.manifest.assetCount,
        },
      }, async (tx) => {
        const storedAssets = new Map<string, Awaited<ReturnType<typeof saveAssetObject>>>();
        for (const asset of plan.assetObjects) {
          const stored = await saveAssetObject({
            assetId: asset.targetId,
            extension: asset.extension,
            data: asset.bytes,
            contentType: asset.mimeType,
          });
          storedAssets.set(asset.targetId, stored);
          createdStorageObjects.push({
            provider: stored.storageProvider,
            reference: stored.storageReference,
          });
        }

        await tx.insert(s.projects).values(plan.project);
        if (plan.factions.length) await tx.insert(s.factions).values(plan.factions);
        if (plan.characters.length) await tx.insert(s.characters).values(plan.characters);
        if (plan.locations.length) await tx.insert(s.locations).values(plan.locations);
        if (plan.timelineEvents.length) await tx.insert(s.timelineEvents).values(plan.timelineEvents);
        if (plan.storyArcs.length) await tx.insert(s.storyArcs).values(plan.storyArcs);
        if (plan.loreRules.length) await tx.insert(s.loreRules).values(plan.loreRules);
        if (plan.generatedStories.length) await tx.insert(s.generatedStories).values(plan.generatedStories);
        if (plan.writingDocuments.length) await tx.insert(s.writingDocuments).values(plan.writingDocuments);
        if (plan.scenes.length) await tx.insert(s.scenes).values(plan.scenes);

        if (plan.assets.length) {
          await tx.insert(s.assets).values(plan.assets.map((asset) => {
            const stored = storedAssets.get(asset.id as string);
            if (!stored) throw new DependencyUnavailableError('A restored asset was not persisted.');
            return {
              ...asset,
              filePath: stored.storageReference,
              storageProvider: stored.storageProvider,
            };
          }));
        }

        if (plan.storyboardPanels.length) {
          await tx.insert(s.storyboardPanels).values(plan.storyboardPanels);
        }

        await logVersion(tx, {
          projectId: plan.targetProjectId,
          userId,
          action: 'create',
          entityType: 'project',
          entityId: plan.targetProjectId,
          changeData: {
            sourceProjectId,
            operation: 'restore_as_new_project',
            entityCounts: plan.entityCounts,
            assetBytesRestored: backup.manifest.totalAssetBytes,
          },
        });

        const lifecycleReceiptId = await recordLifecycleEvent(tx, {
          actorUserId: userId,
          subjectUserId: userId,
          projectId: plan.targetProjectId,
          operation: 'project_restore',
          status: 'completed',
          details: {
            sourceProjectId,
            payloadSha256: backup.manifest.payloadSha256,
            assetsSha256: backup.manifest.assetsSha256,
            entityCounts: plan.entityCounts,
            assetBytesRestored: backup.manifest.totalAssetBytes,
            restoreMode: 'new-project',
          },
        });

        return {
          status: 201,
          body: {
            sourceProjectId,
            restoredProjectId: plan.targetProjectId,
            restoredProjectName: plan.project.name,
            entityCounts: plan.entityCounts,
            assetBytesRestored: backup.manifest.totalAssetBytes,
            lifecycleReceiptId,
          },
        };
      });
    } catch (error) {
      await Promise.allSettled(
        createdStorageObjects.map((object) => deleteAssetObject(object.provider, object.reference)),
      );
      throw error;
    }

    const response = apiSuccess(result.body, context.requestId, result.status);
    response.headers.set('idempotency-replayed', String(result.replayed));
    response.headers.set('x-lifecycle-receipt-id', result.body.lifecycleReceiptId);
    response.headers.set('x-restored-project-id', result.body.restoredProjectId);
    return response;
  })(request);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
