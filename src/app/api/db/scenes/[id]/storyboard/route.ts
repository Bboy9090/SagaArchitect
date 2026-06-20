import { NextResponse } from 'next/server';
import { db } from '@/db';
import { storyboardPanels } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id: sceneId } = await params;
    const list = await db.select().from(storyboardPanels).where(eq(storyboardPanels.sceneId, sceneId));
    // Sort panels by panelNumber
    list.sort((a, b) => a.panelNumber - b.panelNumber);
    const mapped = list.map((p) => ({
      id: p.id,
      scene_id: p.sceneId,
      panel_number: p.panelNumber,
      visual_prompt: p.visualPrompt,
      action_description: p.actionDescription,
      dialogue: p.dialogue || '',
      camera_shot: p.cameraShot,
      asset_id: p.assetId || undefined,
      version: p.version || 1,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    }));
    return NextResponse.json({ ok: true, data: mapped });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }
  try {
    const { id: sceneId } = await params;
    const payload = await req.json();
    const panelId = payload.id || crypto.randomUUID();

    const [existing] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).limit(1);

    const values = {
      id: panelId,
      sceneId,
      panelNumber: typeof payload.panel_number === 'number' ? payload.panel_number : 1,
      visualPrompt: payload.visual_prompt || '',
      actionDescription: payload.action_description || '',
      dialogue: payload.dialogue || '',
      cameraShot: payload.camera_shot || 'Medium Shot',
      assetId: payload.asset_id || null,
      version: payload.version || 1,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(storyboardPanels).set(values).where(eq(storyboardPanels.id, panelId));
    } else {
      await db.insert(storyboardPanels).values(values);
    }

    const [p] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).limit(1);

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
        asset_id: p.assetId || undefined,
        version: p.version || 1,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
