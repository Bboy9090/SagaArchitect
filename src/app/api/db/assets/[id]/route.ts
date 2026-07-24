import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { deleteFileLocal } from '@/lib/storage-driver';
import { logVersion } from '@/lib/version-history';
import { eq } from 'drizzle-orm';
import { requireUser, requireOwnedAsset, AuthError } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });

  try {
    const { id } = await params;
    const userId = await requireUser();
    const asset = await requireOwnedAsset(id, userId);

    if (asset.storageProvider === 'local') {
      try {
        await deleteFileLocal(asset.filePath);
      } catch (error) {
        createLogger().warn('asset.local-delete.failed', {
          assetId: id,
          errorCode: (error as NodeJS.ErrnoException).code || 'UNKNOWN',
        });
      }
    }

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
