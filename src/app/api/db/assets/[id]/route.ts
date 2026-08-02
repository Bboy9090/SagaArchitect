import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { logVersion } from '@/lib/version-history';
import { eq } from 'drizzle-orm';
import { requireUser, requireOwnedAsset, AuthError } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';
import { deleteAssetObject } from '@/lib/storage/asset-storage';
import type { StorageProviderName } from '@/lib/storage/storage-provider';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });

  const { id } = await params;
  try {
    const userId = await requireUser();
    const asset = await requireOwnedAsset(id, userId);

    await db.transaction(async (tx) => {
      await logVersion(tx, {
        projectId: asset.projectId,
        userId,
        action: 'delete',
        entityType: 'asset',
        entityId: id,
        changeData: {
          name: asset.name,
          mimeType: asset.mimeType,
          storageProvider: asset.storageProvider,
        },
      });
      await tx.delete(assets).where(eq(assets.id, id));
    });

    let cleanupPending = false;
    try {
      await deleteAssetObject(
        asset.storageProvider as StorageProviderName,
        asset.filePath,
      );
    } catch (error) {
      cleanupPending = true;
      createLogger().warn('asset.storage-cleanup.pending', {
        assetId: id,
        storageProvider: asset.storageProvider,
        error,
      });
    }

    return NextResponse.json({ ok: true, cleanupPending });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    createLogger().error('asset.delete.failed', { assetId: id, error });
    return NextResponse.json({ ok: false, error: 'Asset deletion failed.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
