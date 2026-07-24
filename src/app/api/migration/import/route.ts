/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as s from '@/db/schema';
import { deleteFileLocal, saveFileLocal } from '@/lib/storage-driver';
import { requireUser } from '@/lib/auth-helpers';
import { DependencyUnavailableError, UnsupportedMediaTypeError } from '@/lib/api-errors';
import { LARGE_MIGRATION_BODY, STORYBOARD_BASE64_BODY } from '@/lib/http/body-limits';
import { readBase64PayloadWithLimit, readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { detectImageMime } from '@/lib/uploads/file-signatures';
import { createLogger } from '@/lib/logger';
import { withApiContext } from '@/lib/with-api-context';

type MigrationPayload = Record<string, any>;

export const POST = withApiContext(async (req, context) => {
  if (!db) throw new DependencyUnavailableError('Database service is unavailable.');

  const userId = await requireUser();
  context.userId = userId;
  const logger = createLogger(context);
  const payload = await readJsonBodyWithLimit<MigrationPayload>(req, {
    policy: LARGE_MIGRATION_BODY,
  });

  const {
    projects = [],
    characters = [],
    factions = [],
    locations = [],
    timelineEvents = [],
    storyArcs = [],
    loreRules = [],
    generatedStories = [],
    scenes = [],
    storyboardPanels = [],
  } = payload;

  const projectIdMap = new Map<string, string>();
  const factionIdMap = new Map<string, string>();
  const characterIdMap = new Map<string, string>();
  const locationIdMap = new Map<string, string>();
  const sceneIdMap = new Map<string, string>();

  projects.forEach((project: { id: string }) => projectIdMap.set(project.id, crypto.randomUUID()));
  factions.forEach((faction: { id: string }) => factionIdMap.set(faction.id, crypto.randomUUID()));
  characters.forEach((character: { id: string }) => characterIdMap.set(character.id, crypto.randomUUID()));
  locations.forEach((location: { id: string }) => locationIdMap.set(location.id, crypto.randomUUID()));
  scenes.forEach((scene: { id: string }) => sceneIdMap.set(scene.id, crypto.randomUUID()));

  const remapArray = (values: string[] | undefined | null, map: Map<string, string>) =>
    (values || []).map((oldId) => map.get(oldId)).filter((id): id is string => typeof id === 'string');

  const createdFilePaths: string[] = [];
  let warningCount = 0;

  try {
    const report = await db.transaction(async (tx) => {
      for (const project of projects) {
        const newId = projectIdMap.get(project.id)!;
        await tx.insert(s.projects).values({
          id: newId,
          ownerId: userId,
          name: project.name,
          concept: project.concept,
          genre: project.genre,
          tone: project.tone,
          era: project.era,
          techLevel: project.tech_level,
          magicSystem: project.magic_system,
          worldOverview: project.world_overview,
          creationMyth: project.creation_myth,
          themes: project.themes || [],
          currentConflict: project.current_conflict,
          prophecyHooks: project.prophecy_hooks || [],
          version: project.version || 1,
        });
      }

      for (const faction of factions) {
        const newId = factionIdMap.get(faction.id)!;
        const newProjectId = projectIdMap.get(faction.project_id || faction.universe_id)!;
        await tx.insert(s.factions).values({
          id: newId,
          projectId: newProjectId,
          name: faction.name,
          type: faction.type,
          ideology: faction.ideology,
          leader: faction.leader,
          resources: faction.resources,
          allies: remapArray(faction.allies, factionIdMap),
          enemies: remapArray(faction.enemies, factionIdMap),
          territory: faction.territory,
          internalConflict: faction.internal_conflict,
          objective: faction.objective,
          symbol: faction.symbol,
          canonStatus: faction.canon_status || 'draft',
          version: faction.version || 1,
        });
      }

      for (const character of characters) {
        const newId = characterIdMap.get(character.id)!;
        const newProjectId = projectIdMap.get(character.project_id || character.universe_id)!;
        const newFactionId = character.faction_id ? factionIdMap.get(character.faction_id) : null;
        const remappedRelationships = (character.relationships || []).map(
          (relationship: { character_id: string; character_name?: string; type?: string }) => ({
            character_id: characterIdMap.get(relationship.character_id) || relationship.character_id,
            character_name: relationship.character_name,
            type: relationship.type,
          }),
        );

        await tx.insert(s.characters).values({
          id: newId,
          projectId: newProjectId,
          factionId: newFactionId,
          name: character.name,
          title: character.title,
          role: character.role,
          motivations: character.motivations,
          fears: character.fears,
          powers: character.powers,
          weaknesses: character.weaknesses,
          relationships: remappedRelationships,
          arcPotential: character.arc_potential,
          status: character.status || 'alive',
          canonStatus: character.canon_status || 'draft',
          appearance: character.appearance,
          speechStyle: character.speech_style,
          version: character.version || 1,
        });
      }

      for (const location of locations) {
        await tx.insert(s.locations).values({
          id: locationIdMap.get(location.id)!,
          projectId: projectIdMap.get(location.project_id || location.universe_id)!,
          name: location.name,
          type: location.type,
          region: location.region,
          description: location.description,
          strategicValue: location.strategic_value,
          mythicImportance: location.mythic_importance,
          canonStatus: location.canon_status || 'draft',
          version: location.version || 1,
        });
      }

      for (const event of timelineEvents) {
        await tx.insert(s.timelineEvents).values({
          projectId: projectIdMap.get(event.project_id || event.universe_id)!,
          title: event.title,
          eraMarker: event.era_marker,
          summary: event.summary,
          affectedCharacters: remapArray(event.affected_characters, characterIdMap),
          affectedFactions: remapArray(event.affected_factions, factionIdMap),
          affectedLocations: remapArray(event.affected_locations, locationIdMap),
          consequences: event.consequences,
          hiddenTruths: event.hidden_truths,
          canonStatus: event.canon_status || 'draft',
          version: event.version || 1,
        });
      }

      for (const arc of storyArcs) {
        await tx.insert(s.storyArcs).values({
          projectId: projectIdMap.get(arc.project_id || arc.universe_id)!,
          title: arc.title,
          type: arc.type || 'hero',
          summary: arc.summary,
          startPoint: arc.start_point,
          endPoint: arc.end_point,
          involvedCharacters: remapArray(arc.involved_characters, characterIdMap),
          involvedFactions: remapArray(arc.involved_factions, factionIdMap),
          themes: arc.themes || [],
          turningPoints: arc.turning_points || [],
          canonStatus: arc.canon_status || 'draft',
          version: arc.version || 1,
        });
      }

      for (const rule of loreRules) {
        await tx.insert(s.loreRules).values({
          projectId: projectIdMap.get(rule.project_id || rule.universe_id)!,
          category: rule.category,
          title: rule.title,
          description: rule.description,
          appliesTo: remapArray(rule.applies_to, characterIdMap),
          canonStatus: rule.canon_status || 'draft',
          version: rule.version || 1,
        });
      }

      for (const story of generatedStories) {
        await tx.insert(s.generatedStories).values({
          projectId: projectIdMap.get(story.project_id || story.universe_id)!,
          title: story.title,
          format: story.format || 'scene',
          content: story.content,
          featuredCharacters: remapArray(story.featured_characters, characterIdMap),
          featuredFactions: remapArray(story.featured_factions, factionIdMap),
          featuredLocations: remapArray(story.featured_locations, locationIdMap),
        });
      }

      for (const scene of scenes) {
        await tx.insert(s.scenes).values({
          id: sceneIdMap.get(scene.id)!,
          projectId: projectIdMap.get(scene.project_id || scene.universe_id)!,
          title: scene.title,
          summary: scene.summary,
          order: scene.order,
          locationId: scene.location_id ? locationIdMap.get(scene.location_id) : null,
          canonStatus: scene.canon_status || 'draft',
          version: scene.version || 1,
        });
      }

      for (const panel of storyboardPanels) {
        const newSceneId = sceneIdMap.get(panel.scene_id)!;
        let assetId: string | null = null;

        if (typeof panel.image_base64 === 'string' && panel.image_base64.startsWith('data:image/')) {
          const match = panel.image_base64.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
          if (!match) {
            warningCount += 1;
            logger.warn('migration.storyboard-sketch.rejected', { panelNumber: panel.panel_number, reason: 'unsupported-data-url' });
          } else {
            const declaredMime = match[1];
            try {
              const buffer = readBase64PayloadWithLimit(match[2], { policy: STORYBOARD_BASE64_BODY });
              const detectedMime = detectImageMime(buffer);
              if (!detectedMime || detectedMime !== declaredMime) {
                throw new UnsupportedMediaTypeError('Storyboard sketch signature does not match its declared image type.');
              }

              const extension = detectedMime === 'image/png' ? '.png' : detectedMime === 'image/webp' ? '.webp' : '.jpg';
              const fileId = crypto.randomUUID();
              const parentScene = scenes.find((scene: { id: string }) => scene.id === panel.scene_id);
              const newProjectId = parentScene
                ? projectIdMap.get(parentScene.project_id || parentScene.universe_id)
                : undefined;

              if (!newProjectId) {
                warningCount += 1;
                logger.warn('migration.storyboard-sketch.skipped', { panelNumber: panel.panel_number, reason: 'missing-parent-project' });
              } else {
                const filePath = await saveFileLocal(buffer, fileId, extension);
                createdFilePaths.push(filePath);
                await tx.insert(s.assets).values({
                  id: fileId,
                  ownerId: userId,
                  projectId: newProjectId,
                  name: `Sketch Panel ${panel.panel_number}${extension}`,
                  filePath,
                  fileSize: buffer.byteLength,
                  mimeType: detectedMime,
                  storageProvider: 'local',
                });
                assetId = fileId;
              }
            } catch (error) {
              warningCount += 1;
              logger.warn('migration.storyboard-sketch.skipped', { panelNumber: panel.panel_number, error });
            }
          }
        }

        await tx.insert(s.storyboardPanels).values({
          sceneId: newSceneId,
          panelNumber: panel.panel_number,
          visualPrompt: panel.visual_prompt,
          actionDescription: panel.action_description,
          dialogue: panel.dialogue,
          cameraShot: panel.camera_shot || 'Medium Shot',
          assetId,
          version: panel.version || 1,
        });
      }

      return {
        imported: {
          projects: projects.length,
          characters: characters.length,
          factions: factions.length,
          locations: locations.length,
          timelineEvents: timelineEvents.length,
          storyArcs: storyArcs.length,
          loreRules: loreRules.length,
          generatedStories: generatedStories.length,
          scenes: scenes.length,
          storyboardPanels: storyboardPanels.length,
        },
        conflicts: 0,
        warnings: warningCount,
      };
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    await Promise.allSettled(createdFilePaths.map((filePath) => deleteFileLocal(filePath)));
    throw error;
  }
});

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
