import { db } from '@/db';
import { storyboardPanels } from '@/db/schema';
import { logVersion } from '@/lib/version-history';
import { eq } from 'drizzle-orm';
import { requireUser, requireOwnedAsset, requireOwnedScene } from '@/lib/auth-helpers';
import { DependencyUnavailableError, ValidationError } from '@/lib/api-errors';
import { apiSuccess } from '@/lib/api-response';
import { NORMAL_MUTATION_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { withApiContext } from '@/lib/with-api-context';

interface StoryboardPayload {
  id?: unknown;
  panel_number?: unknown;
  visual_prompt?: unknown;
  action_description?: unknown;
  dialogue?: unknown;
  camera_shot?: unknown;
  asset_id?: unknown;
  version?: unknown;
}

function mapPanel(panel: typeof storyboardPanels.$inferSelect) {
  return {
    id: panel.id,
    scene_id: panel.sceneId,
    panel_number: panel.panelNumber,
    visual_prompt: panel.visualPrompt,
    action_description: panel.actionDescription,
    dialogue: panel.dialogue || '',
    camera_shot: panel.cameraShot,
    asset_id: panel.assetId || undefined,
    version: panel.version || 1,
    created_at: panel.createdAt.toISOString(),
    updated_at: panel.updatedAt.toISOString(),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApiContext(async (_req, context) => {
    if (!db) throw new DependencyUnavailableError('Database service is unavailable.');
    const { id: sceneId } = await params;
    const userId = await requireUser();
    context.userId = userId;
    await requireOwnedScene(sceneId, userId);
    const list = await db.select().from(storyboardPanels).where(eq(storyboardPanels.sceneId, sceneId));
    list.sort((left, right) => left.panelNumber - right.panelNumber);
    return apiSuccess(list.map(mapPanel), context.requestId);
  })(request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApiContext(async (req, context) => {
    if (!db) throw new DependencyUnavailableError('Database service is unavailable.');
    const { id: sceneId } = await params;
    const userId = await requireUser();
    context.userId = userId;
    const scene = await requireOwnedScene(sceneId, userId);
    const payload = await readJsonBodyWithLimit<StoryboardPayload>(req, { policy: NORMAL_MUTATION_BODY });
    const panelId = typeof payload.id === 'string' && payload.id ? payload.id : crypto.randomUUID();
    const [existing] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).limit(1);

    if (existing && existing.sceneId !== sceneId) {
      throw new ValidationError('Storyboard panel scene mismatch.');
    }

    let assetId: string | null = null;
    if (payload.asset_id !== undefined && payload.asset_id !== null && payload.asset_id !== '') {
      if (typeof payload.asset_id !== 'string') throw new ValidationError('asset_id must be a UUID string.');
      const asset = await requireOwnedAsset(payload.asset_id, userId);
      if (asset.projectId !== scene.projectId) {
        throw new ValidationError('Storyboard assets must belong to the same project as the scene.');
      }
      assetId = asset.id;
    }

    const panelNumber = typeof payload.panel_number === 'number' && Number.isSafeInteger(payload.panel_number)
      ? payload.panel_number
      : 1;
    if (panelNumber < 1) throw new ValidationError('panel_number must be a positive integer.');

    const values = {
      id: panelId,
      sceneId,
      panelNumber,
      visualPrompt: typeof payload.visual_prompt === 'string' ? payload.visual_prompt : '',
      actionDescription: typeof payload.action_description === 'string' ? payload.action_description : '',
      dialogue: typeof payload.dialogue === 'string' ? payload.dialogue : '',
      cameraShot: typeof payload.camera_shot === 'string' && payload.camera_shot.trim()
        ? payload.camera_shot.trim()
        : 'Medium Shot',
      assetId,
      version: typeof payload.version === 'number' && Number.isSafeInteger(payload.version) && payload.version > 0
        ? payload.version
        : 1,
      updatedAt: new Date(),
    };
    const action = existing ? 'update' : 'create';

    await db.transaction(async (tx) => {
      if (existing) await tx.update(storyboardPanels).set(values).where(eq(storyboardPanels.id, panelId));
      else await tx.insert(storyboardPanels).values(values);
      await logVersion(tx, {
        projectId: scene.projectId,
        userId,
        action,
        entityType: 'storyboard_panel',
        entityId: panelId,
        changeData: values,
      });
    });

    const [panel] = await db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).limit(1);
    if (!panel) throw new DependencyUnavailableError('Storyboard panel could not be loaded after persistence.');
    return apiSuccess(mapPanel(panel), context.requestId, existing ? 200 : 201);
  })(request);
}

export const dynamic = 'force-dynamic';
