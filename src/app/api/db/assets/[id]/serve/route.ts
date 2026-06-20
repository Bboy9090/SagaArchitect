
import { db } from '@/db';
import { assets } from '@/db/schema';
import { readFileLocal } from '@/lib/storage-driver';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return new Response('Database not initialized', { status: 500 });
  }

  try {
    const { id } = await params;
    const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);

    if (!asset) {
      return new Response('Asset not found', { status: 404 });
    }

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
    return new Response('Failed to read asset file', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
