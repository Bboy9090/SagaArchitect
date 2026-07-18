import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logVersion } from '@/lib/version-history';

const DEFAULT_USER_ID = '11111111-1111-4111-8111-111111111111';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function cleanObject(obj: Record<string, any>) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const result: Record<string, any> = {};
  for (const k in obj) {
    if (obj[k] !== undefined && obj[k] !== null) {
      result[k] = obj[k];
    }
  }
  return result;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const { id: projectId } = await params;
    const { historyId } = await req.json();

    if (!historyId) {
      return NextResponse.json({ ok: false, error: 'historyId is required' }, { status: 400 });
    }

    const [historyRow] = await db
      .select()
      .from(s.versionHistory)
      .where(eq(s.versionHistory.id, historyId))
      .limit(1);

    if (!historyRow) {
      return NextResponse.json({ ok: false, error: 'History entry not found' }, { status: 404 });
    }

    if (historyRow.projectId !== projectId) {
      return NextResponse.json({ ok: false, error: 'Access denied: project ID mismatch' }, { status: 403 });
    }

    const { entityType, entityId, changeData } = historyRow as {
      entityType: string;
      entityId: string;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      changeData: any;
    };

    await db.transaction(async (tx) => {
      // Determine if entity already exists in DB
      let exists = false;

      switch (entityType) {
        case 'project': {
          const rows = await tx.select().from(s.projects).where(eq(s.projects.id, entityId)).limit(1);
          exists = rows.length > 0;
          const values = cleanObject({
            ownerId: changeData.ownerId || changeData.owner_id || DEFAULT_USER_ID,
            name: changeData.name,
            concept: changeData.concept,
            genre: changeData.genre,
            tone: changeData.tone,
            era: changeData.era,
            techLevel: changeData.techLevel || changeData.tech_level,
            magicSystem: changeData.magicSystem || changeData.magic_system,
            worldOverview: changeData.worldOverview || changeData.world_overview,
            creationMyth: changeData.creationMyth || changeData.creation_myth,
            themes: changeData.themes,
            currentConflict: changeData.currentConflict || changeData.current_conflict,
            prophecyHooks: changeData.prophecyHooks || changeData.prophecy_hooks,
            version: (changeData.version || 1) + 1,
          });
          if (exists) {
            await tx.update(s.projects).set(values).where(eq(s.projects.id, entityId));
          } else {
            await tx.insert(s.projects).values({ id: entityId, ...values } as any);
          }
          break;
        }
        case 'scene': {
          const rows = await tx.select().from(s.scenes).where(eq(s.scenes.id, entityId)).limit(1);
          exists = rows.length > 0;
          const values = cleanObject({
            projectId: changeData.projectId || changeData.project_id || projectId,
            title: changeData.title,
            summary: changeData.summary,
            order: typeof changeData.order === 'number' ? changeData.order : 0,
            locationId: changeData.locationId || changeData.location_id,
            canonStatus: changeData.canonStatus || changeData.canon_status || 'draft',
            version: (changeData.version || 1) + 1,
          });
          if (exists) {
            await tx.update(s.scenes).set(values).where(eq(s.scenes.id, entityId));
          } else {
            await tx.insert(s.scenes).values({ id: entityId, ...values } as any);
          }
          break;
        }
        case 'character': {
          const rows = await tx.select().from(s.characters).where(eq(s.characters.id, entityId)).limit(1);
          exists = rows.length > 0;
          const values = cleanObject({
            projectId: changeData.projectId || changeData.project_id || projectId,
            factionId: changeData.factionId || changeData.faction_id,
            name: changeData.name,
            title: changeData.title,
            role: changeData.role,
            motivations: changeData.motivations,
            fears: changeData.fears,
            powers: changeData.powers,
            weaknesses: changeData.weaknesses,
            relationships: changeData.relationships || [],
            arcPotential: changeData.arcPotential || changeData.arc_potential,
            status: changeData.status || 'alive',
            canonStatus: changeData.canonStatus || changeData.canon_status || 'draft',
            appearance: changeData.appearance,
            speechStyle: changeData.speechStyle || changeData.speech_style,
            version: (changeData.version || 1) + 1,
          });
          if (exists) {
            await tx.update(s.characters).set(values).where(eq(s.characters.id, entityId));
          } else {
            await tx.insert(s.characters).values({ id: entityId, ...values } as any);
          }
          break;
        }
        case 'storyboard_panel': {
          const rows = await tx.select().from(s.storyboardPanels).where(eq(s.storyboardPanels.id, entityId)).limit(1);
          exists = rows.length > 0;
          const values = cleanObject({
            sceneId: changeData.sceneId || changeData.scene_id,
            panelNumber: typeof changeData.panelNumber === 'number' ? changeData.panelNumber : changeData.panel_number || 1,
            visualPrompt: changeData.visualPrompt || changeData.visual_prompt,
            actionDescription: changeData.actionDescription || changeData.action_description,
            dialogue: changeData.dialogue,
            cameraShot: changeData.cameraShot || changeData.camera_shot || 'Medium Shot',
            assetId: changeData.assetId || changeData.asset_id,
            version: (changeData.version || 1) + 1,
          });
          if (exists) {
            await tx.update(s.storyboardPanels).set(values).where(eq(s.storyboardPanels.id, entityId));
          } else {
            await tx.insert(s.storyboardPanels).values({ id: entityId, ...values } as any);
          }
          break;
        }
        case 'asset': {
          const rows = await tx.select().from(s.assets).where(eq(s.assets.id, entityId)).limit(1);
          exists = rows.length > 0;
          const values = cleanObject({
            ownerId: changeData.ownerId || changeData.owner_id || DEFAULT_USER_ID,
            projectId: changeData.projectId || changeData.project_id || projectId,
            name: changeData.name,
            filePath: changeData.filePath || changeData.file_path,
            fileSize: changeData.fileSize || changeData.file_size,
            mimeType: changeData.mimeType || changeData.mime_type,
            storageProvider: changeData.storageProvider || changeData.storage_provider || 'local',
          });
          if (exists) {
            await tx.update(s.assets).set(values).where(eq(s.assets.id, entityId));
          } else {
            await tx.insert(s.assets).values({ id: entityId, ...values } as any);
          }
          break;
        }
        default:
          throw new Error(`Restore operation not supported for entity type '${entityType}'`);
      }

      // Log the restore event itself in version history
      await logVersion(tx, {
        projectId,
        action: 'update',
        entityType,
        entityId,
        changeData: {
          ...changeData,
          _restoredFromHistoryId: historyId,
          _restoredAt: new Date().toISOString(),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Restore operation failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
