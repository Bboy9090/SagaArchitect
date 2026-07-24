import { NextResponse } from 'next/server';
import { db } from '@/db';
import { storyboardPanels, scenes } from '@/db/schema';
import { logVersion } from '@/lib/version-history';
import { eq } from 'drizzle-orm';
import { requireUser, requireOwnedScene, AuthError } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id: sceneId } = await params;
    const userId = await requireUser();
    await requireOwnedScene(sceneId, userId);
    const list = await db.select().from(storyboardPanels).where(eq(storyboardPanels.sceneId, sceneId));
    list.sort((a, b) => a.panelNumber - b.panelNumber);
    return NextResponse.json({
      ok: true,
      data: list.map((p) => ({
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
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id: sceneId } = await params;
    const userId = await requireUser();
    await requireOwnedScene(sceneId, userId);
    const payload = await req.json();
    const panelId = payload.id || crypto.randomUUID();
    const [existing] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).limit(1);

    if (existing && existing.sceneId !== sceneId) {
      return NextResponse.json({ ok: false, error: 'Storyboard panel scene mismatch' }, { status: 400 });
    }

    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);
    const projectId = scene?.projectId;
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
    const action = existing ? 'update' : 'create';

    await db.transaction(async (tx) => {
      if (existing) await tx.update(storyboardPanels).set(values).where(eq(storyboardPanels.id, panelId));
      else await tx.insert(storyboardPanels).values(values);
      if (projectId) {
        await logVersion(tx, {
          projectId,
          userId,
          action,
          entityType: 'storyboard_panel',
          entityId: panelId,
          changeData: values,
        });
      }
    });

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
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
