import type { CanonIssue, CanonIssueEntityType } from '@/types/canon-issues';

export interface CanonDataset {
  projectId: string;
  project: {
    id: string;
    name: string;
    concept?: string | null;
  };
  characters: Array<{
    id: string;
    name: string;
  }>;
  factions: Array<{
    id: string;
    name: string;
  }>;
  locations: Array<{
    id: string;
    name: string;
  }>;
  timelineEvents: Array<{
    id: string;
    title: string;
    affectedCharacters?: string[] | null;
  }>;
  storyArcs: Array<{
    id: string;
    title: string;
    involvedCharacters?: string[] | null;
  }>;
  loreRules: Array<{
    id: string;
    title: string;
    description?: string | null;
  }>;
  generatedStories: Array<{
    id: string;
    title: string;
  }>;
  scenes: Array<{
    id: string;
    projectId: string;
    title: string;
    order: number;
  }>;
  assets: Array<{
    id: string;
    name: string;
    filePath: string;
    storageProvider: string;
  }>;
  storyboardPanels: Array<{
    id: string;
    sceneId: string;
    panelNumber: number;
    visualPrompt: string;
    assetId?: string | null;
  }>;
}

export function scanCanonDataset(dataset: CanonDataset): CanonIssue[] {
  const issues: CanonIssue[] = [];
  const {
    projectId,
    project,
    characters,
    factions,
    locations,
    timelineEvents,
    storyArcs,
    loreRules,
    scenes,
    assets,
    storyboardPanels,
  } = dataset;

  const charIds = new Set(characters.map(c => c.id));
  const sceneIds = new Set(scenes.map(s => s.id));
  const assetIds = new Set(assets.map(a => a.id));

  // A. Orphan scenes
  scenes.forEach(s => {
    if (s.projectId !== projectId) {
      issues.push({
        id: `orphan_scene-scene-${s.id}`,
        projectId,
        category: 'orphan_scene',
        severity: 'error',
        title: 'Orphan Scene Detected',
        explanation: `Scene "${s.title}" belongs to project ID "${s.projectId}" but was found in project "${projectId}".`,
        entityType: 'scene',
        entityId: s.id,
        suggestedFix: 'Reassign this scene to the current project or delete it.',
      });
    }
  });

  // B. Storyboard panels with missing scenes
  storyboardPanels.forEach(p => {
    if (!sceneIds.has(p.sceneId)) {
      issues.push({
        id: `orphan_storyboard_panel-storyboard_panel-${p.id}`,
        projectId,
        category: 'orphan_storyboard_panel',
        severity: 'error',
        title: 'Orphan Storyboard Panel',
        explanation: `Panel #${p.panelNumber} ("${p.visualPrompt.slice(0, 30)}") references scene ID "${p.sceneId}" which does not exist in this project.`,
        entityType: 'storyboard_panel',
        entityId: p.id,
        suggestedFix: 'Link this panel to a valid scene or delete it.',
      });
    }
  });

  // C. Duplicate scene ordering
  const sceneOrderMap = new Map<number, typeof scenes>();
  scenes.forEach(s => {
    const list = sceneOrderMap.get(s.order) || [];
    list.push(s);
    sceneOrderMap.set(s.order, list);
  });
  sceneOrderMap.forEach((list, order) => {
    if (list.length > 1) {
      list.forEach(s => {
        issues.push({
          id: `duplicate_scene_order-scene-${s.id}-${order}`,
          projectId,
          category: 'duplicate_scene_order',
          severity: 'warning',
          title: 'Duplicate Scene Order Value',
          explanation: `Scene "${s.title}" shares the order index (${order}) with other scenes: ${list.map(x => `"${x.title}"`).join(', ')}.`,
          entityType: 'scene',
          entityId: s.id,
          suggestedFix: 'Reorder the scenes to resolve the ordering conflict.',
          metadata: { duplicateOrder: order },
        });
      });
    }
  });

  // D. Duplicate storyboard panel numbers
  const panelsBySceneMap = new Map<string, typeof storyboardPanels>();
  storyboardPanels.forEach(p => {
    const list = panelsBySceneMap.get(p.sceneId) || [];
    list.push(p);
    panelsBySceneMap.set(p.sceneId, list);
  });
  panelsBySceneMap.forEach((list, sceneId) => {
    const numberMap = new Map<number, typeof storyboardPanels>();
    list.forEach(p => {
      const sublist = numberMap.get(p.panelNumber) || [];
      sublist.push(p);
      numberMap.set(p.panelNumber, sublist);
    });
    numberMap.forEach((sublist, num) => {
      if (sublist.length > 1) {
        sublist.forEach(p => {
          issues.push({
            id: `duplicate_storyboard_panel_number-storyboard_panel-${p.id}-${num}`,
            projectId,
            category: 'duplicate_storyboard_panel_number',
            severity: 'warning',
            title: 'Duplicate Storyboard Panel Number',
            explanation: `Panel #${num} shares its number with other panels in scene ID "${sceneId}".`,
            entityType: 'storyboard_panel',
            entityId: p.id,
            suggestedFix: 'Renumber the panels sequentially in this scene.',
            metadata: { sceneId, duplicateNumber: num },
          });
        });
      }
    });
  });

  // E. Empty required creative entities
  const checkEmptyName = (name: string | undefined | null, type: CanonIssueEntityType, id: string, label: string) => {
    if (!name || name.trim() === '' || name.toLowerCase().includes('untitled')) {
      issues.push({
        id: `empty_required_field-${type}-${id}`,
        projectId,
        category: 'empty_required_field',
        severity: 'info',
        title: `Untitled / Empty ${label}`,
        explanation: `This ${label} has a blank, placeholder, or empty name/title.`,
        entityType: type,
        entityId: id,
        suggestedFix: `Enter a descriptive name or title for this ${label}.`,
      });
    }
  };
  checkEmptyName(project.name, 'project', project.id, 'Project');
  characters.forEach(c => checkEmptyName(c.name, 'character', c.id, 'Character'));
  factions.forEach(f => checkEmptyName(f.name, 'faction', f.id, 'Faction'));
  locations.forEach(l => checkEmptyName(l.name, 'location', l.id, 'Location'));
  scenes.forEach(s => checkEmptyName(s.title, 'scene', s.id, 'Scene'));
  timelineEvents.forEach(e => checkEmptyName(e.title, 'timeline_event', e.id, 'Timeline Event'));
  storyArcs.forEach(a => checkEmptyName(a.title, 'story_arc', a.id, 'Story Arc'));
  loreRules.forEach(r => checkEmptyName(r.title, 'lore_rule', r.id, 'Lore Rule'));

  // F. Broken asset references
  storyboardPanels.forEach(p => {
    if (p.assetId && !assetIds.has(p.assetId)) {
      issues.push({
        id: `broken_asset_reference-storyboard_panel-${p.id}-${p.assetId}`,
        projectId,
        category: 'broken_asset_reference',
        severity: 'error',
        title: 'Broken Asset Reference',
        explanation: `Panel #${p.panelNumber} references asset ID "${p.assetId}" which is missing from the database.`,
        entityType: 'storyboard_panel',
        entityId: p.id,
        suggestedFix: 'Re-upload the asset or clear the reference from this panel.',
        metadata: { assetId: p.assetId },
      });
    }
  });

  // G. Timeline ordering conflicts (Deferred)
  issues.push({
    id: `timeline_ordering_conflict-deferred-${projectId}`,
    projectId,
    category: 'timeline_ordering_conflict',
    severity: 'info',
    title: 'Timeline Order Validation Deferred',
    explanation: 'The timeline_events table does not define an explicit order column; ordering validation is deferred.',
    entityType: 'project',
    entityId: projectId,
  });

  // H. Missing character references
  timelineEvents.forEach(e => {
    (e.affectedCharacters || []).forEach(cid => {
      if (!charIds.has(cid)) {
        issues.push({
          id: `missing_character_reference-timeline_event-${e.id}-${cid}`,
          projectId,
          category: 'missing_character_reference',
          severity: 'warning',
          title: 'Missing Character Reference in Timeline',
          explanation: `Timeline Event "${e.title}" references character ID "${cid}" which does not exist in this project.`,
          entityType: 'timeline_event',
          entityId: e.id,
          suggestedFix: 'Remove the invalid character reference or create the character.',
          metadata: { invalidCharacterId: cid },
        });
      }
    });
  });

  storyArcs.forEach(a => {
    (a.involvedCharacters || []).forEach(cid => {
      if (!charIds.has(cid)) {
        issues.push({
          id: `missing_character_reference-story_arc-${a.id}-${cid}`,
          projectId,
          category: 'missing_character_reference',
          severity: 'warning',
          title: 'Missing Character Reference in Story Arc',
          explanation: `Story Arc "${a.title}" references character ID "${cid}" which does not exist in this project.`,
          entityType: 'story_arc',
          entityId: a.id,
          suggestedFix: 'Remove the invalid character reference or create the character.',
          metadata: { invalidCharacterId: cid },
        });
      }
    });
  });

  // I. Lore rule conflicts
  const normalizedRulesMap = new Map<string, Array<{ id: string; title: string; description: string }>>();
  loreRules.forEach(r => {
    const titleNorm = r.title.trim().toLowerCase();
    const descNorm = (r.description || '').trim();
    const list = normalizedRulesMap.get(titleNorm) || [];
    list.push({ id: r.id, title: r.title, description: descNorm });
    normalizedRulesMap.set(titleNorm, list);
  });

  normalizedRulesMap.forEach((list) => {
    if (list.length > 1) {
      // Find duplicates vs definitions
      const descGroups = new Map<string, string[]>();
      list.forEach(item => {
        const key = item.description.toLowerCase();
        const group = descGroups.get(key) || [];
        group.push(item.id);
        descGroups.set(key, group);
      });

      if (descGroups.size === 1) {
        // All share same title and same description -> duplicate_lore_rule
        list.forEach(item => {
          issues.push({
            id: `duplicate_lore_rule-lore_rule-${item.id}`,
            projectId,
            category: 'duplicate_lore_rule',
            severity: 'warning',
            title: 'Duplicate Lore Rule',
            explanation: `Lore Rule "${item.title}" is completely identical to another lore rule in this project.`,
            entityType: 'lore_rule',
            entityId: item.id,
            suggestedFix: 'Remove the duplicate lore rule to keep the rules clean.',
          });
        });
      } else {
        // Same title, different descriptions -> conflicting_lore_definition
        list.forEach(item => {
          issues.push({
            id: `conflicting_lore_definition-lore_rule-${item.id}`,
            projectId,
            category: 'conflicting_lore_definition',
            severity: 'warning',
            title: 'Conflicting Lore Rule Definition',
            explanation: `Lore Rule "${item.title}" shares a title with another rule but has a different description.`,
            entityType: 'lore_rule',
            entityId: item.id,
            suggestedFix: 'Unify the description or differentiate the titles.',
          });
        });
      }
    }
  });

  // Semantic contradiction check is deferred
  issues.push({
    id: `contradictory_lore_deferred-deferred-${projectId}`,
    projectId,
    category: 'contradictory_lore_deferred',
    severity: 'info',
    title: 'Semantic Contradiction Checking Deferred',
    explanation: 'Deep semantic contradiction checks require predicate/value logic fields and are deferred.',
    entityType: 'project',
    entityId: projectId,
  });

  return issues;
}
