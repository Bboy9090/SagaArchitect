import { NextResponse } from 'next/server';
import { db } from '@/db';
import { storyboardPanels } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    const payload = await req.json();

    // Only allow safe partial updates — currently asset_id only.
    // Explicitly handle null to allow clearing the field.
    type UpdateValues = { assetId: string | null; updatedAt: Date };
    const values: UpdateValues = { assetId: null, updatedAt: new Date() };
    if ('asset_id' in payload) {
      values.assetId = payload.asset_id ?? null;
    }

    await db.update(storyboardPanels).set(values).where(eq(storyboardPanels.id, id));

    const [p] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, id)).limit(1);
    if (!p) {
      return NextResponse.json({ ok: false, error: 'Panel not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: p.id,
        scene_id: p.sceneId,
        panel_number: p.panelNumber,
        visual_prompt: p.visualPrompt,
        action_description: p.actionDescription,
        dialogue: p.dialogue || '',
        camera_shot: p.cameraShot,
        asset_id: p.assetId ?? undefined,
        version: p.version || 1,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id } = await params;
    await db.delete(storyboardPanels).where(eq(storyboardPanels.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
