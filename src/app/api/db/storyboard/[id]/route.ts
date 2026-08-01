import { NextResponse } from 'next/server';
import { db } from '@/db';
import { storyboardPanels, scenes } from '@/db/schema';
import { logVersion } from '@/lib/version-history';
import { eq } from 'drizzle-orm';
import { requireUser, requireOwnedStoryboardPanel, AuthError } from '@/lib/auth-helpers';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    await requireOwnedStoryboardPanel(id, userId);
    const payload = await req.json();

    type UpdateValues = { assetId: string | null; updatedAt: Date };
    const values: UpdateValues = { assetId: null, updatedAt: new Date() };
    if ('asset_id' in payload) values.assetId = payload.asset_id ?? null;

    await db.transaction(async (tx) => {
      await tx.update(storyboardPanels).set(values).where(eq(storyboardPanels.id, id));
      const [panel] = await tx.select().from(storyboardPanels).where(eq(storyboardPanels.id, id)).limit(1);
      if (panel) {
        const [scene] = await tx.select().from(scenes).where(eq(scenes.id, panel.sceneId)).limit(1);
        if (scene) {
          await logVersion(tx, {
            projectId: scene.projectId,
            userId,
            action: 'update',
            entityType: 'storyboard_panel',
            entityId: id,
            changeData: values,
          });
        }
      }
    });

    const [p] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, id)).limit(1);
    if (!p) return NextResponse.json({ ok: false, error: 'Panel not found' }, { status: 404 });

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
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  try {
    const { id } = await params;
    const userId = await requireUser();
    const panel = await requireOwnedStoryboardPanel(id, userId);

    await db.transaction(async (tx) => {
      const [scene] = await tx.select().from(scenes).where(eq(scenes.id, panel.sceneId)).limit(1);
      if (scene) {
        await logVersion(tx, {
          projectId: scene.projectId,
          userId,
          action: 'delete',
          entityType: 'storyboard_panel',
          entityId: id,
          changeData: { panelNumber: panel.panelNumber, visualPrompt: panel.visualPrompt },
        });
      }
      await tx.delete(storyboardPanels).where(eq(storyboardPanels.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
