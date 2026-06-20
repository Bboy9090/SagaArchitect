import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_USER_ID = '11111111-1111-4111-8111-111111111111';

export async function POST(req: Request) {
  try {
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

    // Remapping maps to preserve foreign key constraints
    const projectIdMap = new Map<string, string>();
    const factionIdMap = new Map<string, string>();
    const characterIdMap = new Map<string, string>();
    const locationIdMap = new Map<string, string>();
    const sceneIdMap = new Map<string, string>();

    // 1. Generate new UUIDs for top-level keys before writing to preserve relationships
    projects.forEach((p: { id: string }) => projectIdMap.set(p.id, crypto.randomUUID()));
    factions.forEach((f: { id: string }) => factionIdMap.set(f.id, crypto.randomUUID()));
    characters.forEach((c: { id: string }) => characterIdMap.set(c.id, crypto.randomUUID()));
    locations.forEach((l: { id: string }) => locationIdMap.set(l.id, crypto.randomUUID()));
    scenes.forEach((sc: { id: string }) => sceneIdMap.set(sc.id, crypto.randomUUID()));

    const helperRemapArray = (arr: string[] | undefined | null, map: Map<string, string>) => {
      return (arr || [])
        .map(oldId => map.get(oldId))
        .filter((id): id is string => typeof id === 'string');
    };

    // 2. Wrap all insertions in an atomic database transaction
    const report = await db!.transaction(async (tx) => {
      // Confirm or seed default user record
      const existingUser = await tx.select().from(s.users).where(eq(s.users.id, DEFAULT_USER_ID)).limit(1);
      if (existingUser.length === 0) {
        await tx.insert(s.users).values({
          id: DEFAULT_USER_ID,
          name: 'Default Creator',
          email: 'creator@phoenixcreator.studio',
          passwordHash: 'seeded_placeholder',
        });
      }

      // Insert Projects
      for (const p of projects) {
        const newId = projectIdMap.get(p.id)!;
        await tx.insert(s.projects).values({
          id: newId,
          ownerId: DEFAULT_USER_ID,
          name: p.name,
          concept: p.concept,
          genre: p.genre,
          tone: p.tone,
          era: p.era,
          techLevel: p.tech_level,
          magicSystem: p.magic_system,
          worldOverview: p.world_overview,
          creationMyth: p.creation_myth,
          themes: p.themes || [],
          currentConflict: p.current_conflict,
          prophecyHooks: p.prophecy_hooks || [],
          version: p.version || 1,
        });
      }

      // Insert Factions
      for (const f of factions) {
        const newId = factionIdMap.get(f.id)!;
        const newProjId = projectIdMap.get(f.project_id || f.universe_id)!;
        const remappedAllies = helperRemapArray(f.allies, factionIdMap);
        const remappedEnemies = helperRemapArray(f.enemies, factionIdMap);

        await tx.insert(s.factions).values({
          id: newId,
          projectId: newProjId,
          name: f.name,
          type: f.type,
          ideology: f.ideology,
          leader: f.leader,
          resources: f.resources,
          allies: remappedAllies,
          enemies: remappedEnemies,
          territory: f.territory,
          internalConflict: f.internal_conflict,
          objective: f.objective,
          symbol: f.symbol,
          canonStatus: f.canon_status || 'draft',
          version: f.version || 1,
        });
      }

      // Insert Characters
      for (const c of characters) {
        const newId = characterIdMap.get(c.id)!;
        const newProjId = projectIdMap.get(c.project_id || c.universe_id)!;
        const newFactionId = c.faction_id ? factionIdMap.get(c.faction_id) : null;

        // Remap character relationships array
        const remappedRelations = (c.relationships || []).map((r: { character_id: string; character_name?: string; type?: string }) => ({
          character_id: characterIdMap.get(r.character_id) || r.character_id,
          character_name: r.character_name,
          type: r.type,
        }));

        await tx.insert(s.characters).values({
          id: newId,
          projectId: newProjId,
          factionId: newFactionId,
          name: c.name,
          title: c.title,
          role: c.role,
          motivations: c.motivations,
          fears: c.fears,
          powers: c.powers,
          weaknesses: c.weaknesses,
          relationships: remappedRelations,
          arcPotential: c.arc_potential,
          status: c.status || 'alive',
          canonStatus: c.canon_status || 'draft',
          appearance: c.appearance,
          speechStyle: c.speech_style,
          version: c.version || 1,
        });
      }

      // Insert Locations
      for (const l of locations) {
        const newId = locationIdMap.get(l.id)!;
        const newProjId = projectIdMap.get(l.project_id || l.universe_id)!;

        await tx.insert(s.locations).values({
          id: newId,
          projectId: newProjId,
          name: l.name,
          type: l.type,
          region: l.region,
          description: l.description,
          strategicValue: l.strategic_value,
          mythicImportance: l.mythic_importance,
          canonStatus: l.canon_status || 'draft',
          version: l.version || 1,
        });
      }

      // Insert Timeline Events
      for (const e of timelineEvents) {
        const newProjId = projectIdMap.get(e.project_id || e.universe_id)!;
        const remappedChars = helperRemapArray(e.affected_characters, characterIdMap);
        const remappedFactions = helperRemapArray(e.affected_factions, factionIdMap);
        const remappedLocs = helperRemapArray(e.affected_locations, locationIdMap);

        await tx.insert(s.timelineEvents).values({
          projectId: newProjId,
          title: e.title,
          eraMarker: e.era_marker,
          summary: e.summary,
          affectedCharacters: remappedChars,
          affectedFactions: remappedFactions,
          affectedLocations: remappedLocs,
          consequences: e.consequences,
          hiddenTruths: e.hidden_truths,
          canonStatus: e.canon_status || 'draft',
          version: e.version || 1,
        });
      }

      // Insert Story Arcs
      for (const a of storyArcs) {
        const newProjId = projectIdMap.get(a.project_id || a.universe_id)!;
        const remappedChars = helperRemapArray(a.involved_characters, characterIdMap);
        const remappedFactions = helperRemapArray(a.involved_factions, factionIdMap);

        await tx.insert(s.storyArcs).values({
          projectId: newProjId,
          title: a.title,
          type: a.type || 'hero',
          summary: a.summary,
          startPoint: a.start_point,
          endPoint: a.end_point,
          involvedCharacters: remappedChars,
          involvedFactions: remappedFactions,
          themes: a.themes || [],
          turningPoints: a.turning_points || [],
          canonStatus: a.canon_status || 'draft',
          version: a.version || 1,
        });
      }

      // Insert Lore Rules
      for (const r of loreRules) {
        const newProjId = projectIdMap.get(r.project_id || r.universe_id)!;
        const remappedApplies = helperRemapArray(r.applies_to, characterIdMap);

        await tx.insert(s.loreRules).values({
          projectId: newProjId,
          category: r.category,
          title: r.title,
          description: r.description,
          appliesTo: remappedApplies,
          canonStatus: r.canon_status || 'draft',
          version: r.version || 1,
        });
      }

      // Insert Generated Stories
      for (const st of generatedStories) {
        const newProjId = projectIdMap.get(st.project_id || st.universe_id)!;
        const remappedChars = helperRemapArray(st.featured_characters, characterIdMap);
        const remappedFactions = helperRemapArray(st.featured_factions, factionIdMap);
        const remappedLocs = helperRemapArray(st.featured_locations, locationIdMap);

        await tx.insert(s.generatedStories).values({
          projectId: newProjId,
          title: st.title,
          format: st.format || 'scene',
          content: st.content,
          featuredCharacters: remappedChars,
          featuredFactions: remappedFactions,
          featuredLocations: remappedLocs,
        });
      }

      // Insert Scenes
      for (const sc of scenes) {
        const newId = sceneIdMap.get(sc.id)!;
        const newProjId = projectIdMap.get(sc.project_id)!;
        const newLocId = sc.location_id ? locationIdMap.get(sc.location_id) : null;

        await tx.insert(s.scenes).values({
          id: newId,
          projectId: newProjId,
          title: sc.title,
          summary: sc.summary,
          order: sc.order,
          locationId: newLocId,
          canonStatus: sc.canon_status || 'draft',
          version: sc.version || 1,
        });
      }

      // Insert Storyboard Panels
      for (const p of storyboardPanels) {
        const newSceneId = sceneIdMap.get(p.scene_id)!;
        await tx.insert(s.storyboardPanels).values({
          sceneId: newSceneId,
          panelNumber: p.panel_number,
          visualPrompt: p.visual_prompt,
          actionDescription: p.action_description,
          dialogue: p.dialogue,
          cameraShot: p.camera_shot || 'Medium Shot',
          version: p.version || 1,
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
        warnings: 0,
      };
    });

    return NextResponse.json({
      ok: true,
      report,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database transaction failed';
    console.error('Migration transaction error:', error);
    return NextResponse.json({
      ok: false,
      error: msg,
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
