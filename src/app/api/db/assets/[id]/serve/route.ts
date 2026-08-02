import { db } from '@/db';
import { requireUser, requireOwnedAsset, AuthError } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';
import { readAssetObject } from '@/lib/storage/asset-storage';
import type { StorageProviderName } from '@/lib/storage/storage-provider';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return new Response('Service unavailable', { status: 503 });

  const { id } = await params;
  try {
    const userId = await requireUser();
    const asset = await requireOwnedAsset(id, userId);
    const bytes = await readAssetObject(
      asset.storageProvider as StorageProviderName,
      asset.filePath,
    );
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': bytes.byteLength.toString(),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return new Response(error.message, { status: error.status });
    createLogger().error('asset.serve.failed', {
      assetId: id,
      error,
    });
    return new Response('Asset is temporarily unavailable.', { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
