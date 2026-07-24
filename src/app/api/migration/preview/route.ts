import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helpers';
import { LARGE_MIGRATION_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { withApiContext } from '@/lib/with-api-context';

type ProjectInput = { id: string };
type CharacterInput = { name: string; project_id?: string; universe_id?: string };
type SceneInput = { id: string; title: string; project_id?: string };
type PanelInput = { panel_number: number; scene_id?: string };

interface MigrationPreviewPayload {
  projects?: ProjectInput[];
  characters?: CharacterInput[];
  factions?: unknown[];
  locations?: unknown[];
  timelineEvents?: unknown[];
  storyArcs?: unknown[];
  loreRules?: unknown[];
  generatedStories?: unknown[];
  scenes?: SceneInput[];
  storyboardPanels?: PanelInput[];
}

export const POST = withApiContext(async (req, context) => {
  const userId = await requireUser();
  context.userId = userId;

  const payload = await readJsonBodyWithLimit<MigrationPreviewPayload>(req, {
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

  const projectIds = new Set(projects.map((project) => project.id));
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const conflicts: string[] = [];
  const warnings: string[] = [];

  if (projects.length === 0) warnings.push('No projects found in the import payload.');

  characters.forEach((character) => {
    const projectId = character.project_id || character.universe_id;
    if (!projectId || !projectIds.has(projectId)) {
      warnings.push(`Character "${character.name}" references a project ID that does not exist in the payload.`);
    }
  });

  scenes.forEach((scene) => {
    if (!scene.project_id || !projectIds.has(scene.project_id)) {
      warnings.push(`Scene "${scene.title}" references a project ID that does not exist in the payload.`);
    }
  });

  storyboardPanels.forEach((panel) => {
    if (!panel.scene_id || !sceneIds.has(panel.scene_id)) {
      warnings.push(`Storyboard Panel #${panel.panel_number} references a scene ID that does not exist in the payload.`);
    }
  });

  return NextResponse.json({
    ok: true,
    stats: {
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
    conflicts,
    warnings,
  });
});

export const dynamic = 'force-dynamic';
