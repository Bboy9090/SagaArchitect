import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  assets,
  characters,
  factions,
  generatedStories,
  locations,
  loreRules,
  scenes,
  storyboardPanels,
  storyArcs,
  timelineEvents,
  writingDocuments,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { requireOwnedProject, requireUser, AuthError } from '@/lib/auth-helpers';
import { DependencyUnavailableError } from '@/lib/api-errors';
import { recordLifecycleEvent } from '@/lib/data-lifecycle';
import { createProjectBackup } from '@/lib/project-backup';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 503 });

  try {
    const { id } = await params;
    const userId = await requireUser();
    const project = await requireOwnedProject(id, userId);

    const [
      projectCharacters,
      projectFactions,
      projectLocations,
      projectTimeline,
      projectArcs,
      projectLore,
      projectStories,
      projectDocuments,
      projectScenes,
      projectAssets,
    ] = await Promise.all([
      db.select().from(characters).where(eq(characters.projectId, id)),
      db.select().from(factions).where(eq(factions.projectId, id)),
      db.select().from(locations).where(eq(locations.projectId, id)),
      db.select().from(timelineEvents).where(eq(timelineEvents.projectId, id)),
      db.select().from(storyArcs).where(eq(storyArcs.projectId, id)),
      db.select().from(loreRules).where(eq(loreRules.projectId, id)),
      db.select().from(generatedStories).where(eq(generatedStories.projectId, id)),
      db.select().from(writingDocuments).where(eq(writingDocuments.projectId, id)),
      db.select().from(scenes).where(eq(scenes.projectId, id)),
      db.select({
        id: assets.id,
        projectId: assets.projectId,
        name: assets.name,
        fileSize: assets.fileSize,
        mimeType: assets.mimeType,
        storageProvider: assets.storageProvider,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
      }).from(assets).where(eq(assets.projectId, id)),
    ]);

    const sceneIds = projectScenes.map(scene => scene.id);
    const projectPanels = sceneIds.length
      ? await db.select().from(storyboardPanels).where(inArray(storyboardPanels.sceneId, sceneIds))
      : [];

    const backup = createProjectBackup({
      project: {
        id: project.id,
        name: project.name,
        concept: project.concept,
        genre: project.genre,
        tone: project.tone,
        era: project.era,
        techLevel: project.techLevel,
        magicSystem: project.magicSystem,
        worldOverview: project.worldOverview,
        creationMyth: project.creationMyth,
        themes: project.themes,
        currentConflict: project.currentConflict,
        prophecyHooks: project.prophecyHooks,
        publishingMetadata: project.publishingMetadata,
        version: project.version,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      collections: {
        assets: projectAssets,
        characters: projectCharacters,
        factions: projectFactions,
        generatedStories: projectStories,
        locations: projectLocations,
        loreRules: projectLore,
        scenes: projectScenes,
        storyboardPanels: projectPanels,
        storyArcs: projectArcs,
        timelineEvents: projectTimeline,
        writingDocuments: projectDocuments,
      },
    });

    let receiptId = '';
    await db.transaction(async tx => {
      receiptId = await recordLifecycleEvent(tx, {
        actorUserId: userId,
        subjectUserId: userId,
        projectId: id,
        operation: 'project_backup_export',
        status: 'completed',
        details: {
          payloadSha256: backup.manifest.payloadSha256,
          entityCounts: backup.manifest.entityCounts,
          assetBytesIncluded: false,
        },
      });
    });

    const response = NextResponse.json({ ok: true, data: backup });
    response.headers.set('content-disposition', `attachment; filename="phoenix-project-${id}-backup.json"`);
    response.headers.set('x-lifecycle-receipt-id', receiptId);
    response.headers.set('x-backup-sha256', backup.manifest.payloadSha256);
    return response;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DependencyUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Project backup failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
