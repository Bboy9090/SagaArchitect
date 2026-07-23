
import { db } from '@/db';
import { readFileLocal } from '@/lib/storage-driver';
import { requireUser, requireOwnedAsset } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return new Response('Database not initialized', { status: 500 });
  }

  try {
    const { id } = await params;
    const userId = await requireUser();
    const asset = await requireOwnedAsset(id, userId);

    if (asset.storageProvider === 'local') {
      const buffer = await readFileLocal(asset.filePath);
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': asset.mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return new Response('Unsupported storage provider', { status: 400 });
  } catch (error) {
    console.error('Serve asset failed:', error);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const status = error && (error as any).status ? (error as any).status : 500;
    const msg = error instanceof Error ? error.message : 'Failed to read asset file';
    return new Response(msg, { status });
  }
}

export const dynamic = 'force-dynamic';
