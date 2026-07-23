import { db } from '@/db';
import * as s from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { scanCanonDataset, type CanonDataset } from './canon-scanner';
import type { CanonScanResult, CanonIssueCategory } from '@/types/canon-issues';
import fs from 'fs';

export async function loadProjectCanonDataset(projectId: string): Promise<CanonDataset | null> {
  if (!db) return null;

  const [project] = await db.select().from(s.projects).where(eq(s.projects.id, projectId)).limit(1);
  if (!project) return null;

  const characters = await db.select().from(s.characters).where(eq(s.characters.projectId, projectId));
  const factions = await db.select().from(s.factions).where(eq(s.factions.projectId, projectId));
  const locations = await db.select().from(s.locations).where(eq(s.locations.projectId, projectId));
  const timelineEvents = await db.select().from(s.timelineEvents).where(eq(s.timelineEvents.projectId, projectId));
  const storyArcs = await db.select().from(s.storyArcs).where(eq(s.storyArcs.projectId, projectId));
  const loreRules = await db.select().from(s.loreRules).where(eq(s.loreRules.projectId, projectId));
  const generatedStories = await db.select().from(s.generatedStories).where(eq(s.generatedStories.projectId, projectId));
  const scenes = await db.select().from(s.scenes).where(eq(s.scenes.projectId, projectId));
  const assets = await db.select().from(s.assets).where(eq(s.assets.projectId, projectId));

  // Query storyboard panels joined with scenes to filter by projectId
  let storyboardPanels: Array<{ id: string; sceneId: string; panelNumber: number; visualPrompt: string; assetId: string | null }> = [];
  if (scenes.length > 0) {
    const sceneIds = scenes.map(x => x.id);
    storyboardPanels = await db.select({
      id: s.storyboardPanels.id,
      sceneId: s.storyboardPanels.sceneId,
      panelNumber: s.storyboardPanels.panelNumber,
      visualPrompt: s.storyboardPanels.visualPrompt,
      actionDescription: s.storyboardPanels.actionDescription,
      dialogue: s.storyboardPanels.dialogue,
      cameraShot: s.storyboardPanels.cameraShot,
      assetId: s.storyboardPanels.assetId,
      version: s.storyboardPanels.version
    })
    .from(s.storyboardPanels)
    .where(inArray(s.storyboardPanels.sceneId, sceneIds));
  }

  return {
    projectId,
    project: {
      id: project.id,
      name: project.name,
      concept: project.concept,
    },
    characters: characters.map(c => ({ id: c.id, name: c.name })),
    factions: factions.map(f => ({ id: f.id, name: f.name })),
    locations: locations.map(l => ({ id: l.id, name: l.name })),
    timelineEvents: timelineEvents.map(e => ({
      id: e.id,
      title: e.title,
      affectedCharacters: e.affectedCharacters,
    })),
    storyArcs: storyArcs.map(a => ({
      id: a.id,
      title: a.title,
      involvedCharacters: a.involvedCharacters,
    })),
    loreRules: loreRules.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
    })),
    generatedStories: generatedStories.map(st => ({ id: st.id, title: st.title })),
    scenes: scenes.map(sc => ({
      id: sc.id,
      projectId: sc.projectId,
      title: sc.title,
      order: sc.order,
    })),
    assets: assets.map(a => ({
      id: a.id,
      name: a.name,
      filePath: a.filePath,
      storageProvider: a.storageProvider,
    })),
    storyboardPanels: storyboardPanels.map(p => ({
      id: p.id,
      sceneId: p.sceneId,
      panelNumber: p.panelNumber,
      visualPrompt: p.visualPrompt,
      assetId: p.assetId,
    })),
  };
}

export async function scanProject(projectId: string): Promise<CanonScanResult | null> {
  const dataset = await loadProjectCanonDataset(projectId);
  if (!dataset) return null;

  const scannedAt = new Date().toISOString();
  const issues = scanCanonDataset(dataset);

  // Perform physical file checks for local assets
  dataset.assets.forEach(a => {
    if (a.storageProvider === 'local') {
      if (!fs.existsSync(a.filePath)) {
        issues.push({
          id: `missing_local_asset_file-asset-${a.id}`,
          projectId,
          category: 'missing_local_asset_file',
          severity: 'warning',
          title: 'Local Asset File Missing',
          explanation: `Asset "${a.name}" record exists, but the file was not found on disk at "${a.filePath}".`,
          entityType: 'asset',
          entityId: a.id,
          suggestedFix: 'Re-upload the asset file to restore the reference.',
        });
      }
    } else {
      issues.push({
        id: `asset_file_validation_deferred-asset-${a.id}`,
        projectId,
        category: 'asset_file_validation_deferred',
        severity: 'info',
        title: 'Asset File Validation Deferred',
        explanation: `Asset "${a.name}" uses storage provider "${a.storageProvider}". External validation is deferred.`,
        entityType: 'asset',
        entityId: a.id,
      });
    }
  });

  // Calculate totals
  const countsBySeverity = { info: 0, warning: 0, error: 0 };
  const countsByCategory: Record<CanonIssueCategory, number> = {
    orphan_scene: 0,
    orphan_storyboard_panel: 0,
    duplicate_scene_order: 0,
    duplicate_storyboard_panel_number: 0,
    empty_required_field: 0,
    broken_asset_reference: 0,
    missing_local_asset_file: 0,
    asset_file_validation_deferred: 0,
    timeline_ordering_conflict: 0,
    missing_character_reference: 0,
    duplicate_lore_rule: 0,
    conflicting_lore_definition: 0,
    contradictory_lore_deferred: 0,
  };

  issues.forEach(i => {
    countsBySeverity[i.severity]++;
    countsByCategory[i.category]++;
  });

  return {
    projectId,
    scannedAt,
    totalIssues: issues.length,
    countsBySeverity,
    countsByCategory,
    issues,
  };
}
