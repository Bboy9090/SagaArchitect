import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  try {
    await requireUser();
    const payload = await req.json();
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

    const projectIds = new Set(projects.map((p: { id: string }) => p.id));
    const sceneIds = new Set(scenes.map((s: { id: string }) => s.id));

    const conflicts: string[] = [];
    const warnings: string[] = [];

    // Verify projects exist
    if (projects.length === 0) {
      warnings.push('No projects found in the import payload.');
    }

    // Verify characters refer to existing projects
    characters.forEach((c: { name: string; project_id?: string; universe_id?: string }) => {
      const pid = c.project_id || c.universe_id;
      if (!pid || !projectIds.has(pid)) {
        warnings.push(`Character "${c.name}" references a project ID that does not exist in the payload.`);
      }
    });

    // Verify scenes refer to existing projects
    scenes.forEach((s: { title: string; project_id?: string }) => {
      if (!s.project_id || !projectIds.has(s.project_id)) {
        warnings.push(`Scene "${s.title}" references a project ID that does not exist in the payload.`);
      }
    });

    // Verify storyboard panels refer to existing scenes
    storyboardPanels.forEach((p: { panel_number: number; scene_id?: string }) => {
      if (!p.scene_id || !sceneIds.has(p.scene_id)) {
        warnings.push(`Storyboard Panel #${p.panel_number} references a scene ID that does not exist in the payload.`);
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
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Invalid JSON payload';
    return NextResponse.json({
      ok: false,
      error: msg,
    }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
