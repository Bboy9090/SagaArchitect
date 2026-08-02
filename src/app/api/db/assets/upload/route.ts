import { db } from '@/db';
import { assets } from '@/db/schema';
import { logVersion } from '@/lib/version-history';
import { requireUser, requireOwnedProject } from '@/lib/auth-helpers';
import { apiSuccess } from '@/lib/api-response';
import { DependencyUnavailableError, ValidationError } from '@/lib/api-errors';
import { ASSET_UPLOAD_BODY } from '@/lib/http/body-limits';
import { readFormDataWithLimit } from '@/lib/http/read-bounded-body';
import { consumeRateLimit } from '@/lib/rate-limit/rate-limiter';
import { deleteAssetObject, saveAssetObject } from '@/lib/storage/asset-storage';
import { validateUpload } from '@/lib/uploads/validate-upload';
import { withApiContext } from '@/lib/with-api-context';

export const POST = withApiContext(async (req, context) => {
  if (!db) throw new DependencyUnavailableError('Database service is unavailable.');

  const userId = await requireUser();
  context.userId = userId;
  await consumeRateLimit(req, 'assetUpload', userId);

  const formData = await readFormDataWithLimit(req, { policy: ASSET_UPLOAD_BODY });
  const rawFile = formData.get('file');
  const projectId = formData.get('projectId');

  if (!(rawFile instanceof File)) throw new ValidationError('No file was uploaded.');
  if (typeof projectId !== 'string' || !projectId.trim()) {
    throw new ValidationError('A project ID is required.');
  }

  await requireOwnedProject(projectId, userId);
  const validated = await validateUpload(rawFile);
  const stored = await saveAssetObject({
    assetId: validated.id,
    extension: validated.extension,
    data: validated.buffer,
    contentType: validated.mimeType,
  });

  try {
    await db.transaction(async (tx) => {
      await tx.insert(assets).values({
        id: validated.id,
        ownerId: userId,
        projectId,
        name: validated.displayName,
        filePath: stored.storageReference,
        fileSize: stored.size,
        mimeType: stored.contentType,
        storageProvider: stored.storageProvider,
      });
      await logVersion(tx, {
        projectId,
        userId,
        action: 'create',
        entityType: 'asset',
        entityId: validated.id,
        changeData: {
          name: validated.displayName,
          fileSize: stored.size,
          mimeType: stored.contentType,
          storageProvider: stored.storageProvider,
        },
      });
    });
  } catch (error) {
    await deleteAssetObject(stored.storageProvider, stored.storageReference).catch(() => undefined);
    throw error;
  }

  return apiSuccess(
    {
      id: validated.id,
      name: validated.displayName,
      fileSize: stored.size,
      mimeType: stored.contentType,
      storageProvider: stored.storageProvider,
    },
    context.requestId,
    201,
  );
});

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
