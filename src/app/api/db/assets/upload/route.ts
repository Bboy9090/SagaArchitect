import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { saveFileLocal } from '@/lib/storage-driver';
import path from 'path';

const DEFAULT_USER_ID = '11111111-1111-4111-8111-111111111111';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

export async function POST(req: Request) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'No project ID provided' }, { status: 400 });
    }

    // Validation: Mime Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: `Invalid file type: ${file.type}. Allowed types: PNG, JPG, GIF, WEBP.` }, { status: 400 });
    }

    // Validation: File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Limit: 5MB.` }, { status: 400 });
    }

    const fileId = crypto.randomUUID();
    const extension = path.extname(file.name) || '.jpg';
    
    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save locally
    const filePath = await saveFileLocal(buffer, fileId, extension);

    // Insert database record
    await db.insert(assets).values({
      id: fileId,
      ownerId: DEFAULT_USER_ID,
      projectId,
      name: file.name,
      filePath,
      fileSize: file.size,
      mimeType: file.type,
      storageProvider: 'local',
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: fileId,
        name: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
