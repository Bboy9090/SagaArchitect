import type { Universe, Faction, Character, Location, TimelineEvent, StoryArc, LoreRule, GeneratedStory, WritingDocument, MediaProject, SharedLoreEntry, Scene, StoryboardPanel } from './types';

const KEYS = {
  universes: 'phoenix_projects',
  factions: (uid: string) => `phoenix_factions_${uid}`,
  characters: (uid: string) => `phoenix_characters_${uid}`,
  locations: (uid: string) => `phoenix_locations_${uid}`,
  timeline: (uid: string) => `phoenix_timeline_${uid}`,
  arcs: (uid: string) => `phoenix_arcs_${uid}`,
  lore: (uid: string) => `phoenix_lore_${uid}`,
  stories: (uid: string) => `phoenix_stories_${uid}`,
  writingDocuments: (uid: string) => `phoenix_writing_documents_${uid}`,
  projects: (uid: string) => `phoenix_projects_${uid}`,
  sharedLorePool: 'phoenix_shared_lore_pool',
  scenes: (uid: string) => `phoenix_scenes_${uid}`,
  storyboardPanels: (sid: string) => `phoenix_storyboard_panels_${sid}`,
};

function migrateLegacyData(): void {
  if (typeof window === 'undefined') return;
  const legacyUniversesRaw = localStorage.getItem('saga_universes');
  const newProjectsRaw = localStorage.getItem('phoenix_projects');
  
  if (legacyUniversesRaw && !newProjectsRaw) {
    try {
      const universes = JSON.parse(legacyUniversesRaw) as Universe[];
      localStorage.setItem('phoenix_projects', legacyUniversesRaw);
      
      universes.forEach(u => {
        const uid = u.id;
        const copyCollection = (legacyKey: string, newKey: string) => {
          const rawLegacy = localStorage.getItem(legacyKey);
          const rawNew = localStorage.getItem(newKey);
          if (rawLegacy && !rawNew) {
            localStorage.setItem(newKey, rawLegacy);
          }
        };
        copyCollection(`saga_factions_${uid}`, `phoenix_factions_${uid}`);
        copyCollection(`saga_characters_${uid}`, `phoenix_characters_${uid}`);
        copyCollection(`saga_locations_${uid}`, `phoenix_locations_${uid}`);
        copyCollection(`saga_timeline_${uid}`, `phoenix_timeline_${uid}`);
        copyCollection(`saga_arcs_${uid}`, `phoenix_arcs_${uid}`);
        copyCollection(`saga_lore_${uid}`, `phoenix_lore_${uid}`);
        copyCollection(`saga_stories_${uid}`, `phoenix_stories_${uid}`);
        copyCollection(`saga_projects_${uid}`, `phoenix_projects_${uid}`);
      });
      
      const rawLegacyPool = localStorage.getItem('saga_shared_lore_pool');
      const rawNewPool = localStorage.getItem('phoenix_shared_lore_pool');
      if (rawLegacyPool && !rawNewPool) {
        localStorage.setItem('phoenix_shared_lore_pool', rawLegacyPool);
      }
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }
}

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyData();
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}


// Universes
export const getUniverses = (): Universe[] => get<Universe>(KEYS.universes);
export const saveUniverse = (universe: Universe): void => {
  const all = getUniverses();
  const idx = all.findIndex(u => u.id === universe.id);
  if (idx >= 0) {
    all[idx] = { ...universe, updated_at: new Date().toISOString() };
  } else {
    all.push(universe);
  }
  set(KEYS.universes, all);
};
export const deleteUniverse = (id: string): void => {
  set(KEYS.universes, getUniverses().filter(u => u.id !== id));
  localStorage.removeItem(KEYS.factions(id));
  localStorage.removeItem(KEYS.characters(id));
  localStorage.removeItem(KEYS.locations(id));
  localStorage.removeItem(KEYS.timeline(id));
  localStorage.removeItem(KEYS.arcs(id));
  localStorage.removeItem(KEYS.lore(id));
  localStorage.removeItem(KEYS.stories(id));
  localStorage.removeItem(KEYS.writingDocuments(id));
  localStorage.removeItem(KEYS.projects(id));
};
export const getUniverseById = (id: string): Universe | undefined =>
  getUniverses().find(u => u.id === id);

// Factions
export const getFactions = (universeId: string): Faction[] => get<Faction>(KEYS.factions(universeId));
export const saveFaction = (faction: Faction): void => {
  const all = getFactions(faction.universe_id);
  const idx = all.findIndex(f => f.id === faction.id);
  if (idx >= 0) all[idx] = faction; else all.push(faction);
  set(KEYS.factions(faction.universe_id), all);
};
export const deleteFaction = (universeId: string, id: string): void =>
  set(KEYS.factions(universeId), getFactions(universeId).filter(f => f.id !== id));
export const saveFactions = (universeId: string, factions: Faction[]): void =>
  set(KEYS.factions(universeId), factions);

// Characters
export const getCharacters = (universeId: string): Character[] => get<Character>(KEYS.characters(universeId));
export const saveCharacter = (character: Character): void => {
  const all = getCharacters(character.universe_id);
  const idx = all.findIndex(c => c.id === character.id);
  if (idx >= 0) all[idx] = character; else all.push(character);
  set(KEYS.characters(character.universe_id), all);
};
export const deleteCharacter = (universeId: string, id: string): void =>
  set(KEYS.characters(universeId), getCharacters(universeId).filter(c => c.id !== id));
export const saveCharacters = (universeId: string, characters: Character[]): void =>
  set(KEYS.characters(universeId), characters);

// Locations
export const getLocations = (universeId: string): Location[] => get<Location>(KEYS.locations(universeId));
export const saveLocation = (location: Location): void => {
  const all = getLocations(location.universe_id);
  const idx = all.findIndex(l => l.id === location.id);
  if (idx >= 0) all[idx] = location; else all.push(location);
  set(KEYS.locations(location.universe_id), all);
};
export const deleteLocation = (universeId: string, id: string): void =>
  set(KEYS.locations(universeId), getLocations(universeId).filter(l => l.id !== id));
export const saveLocations = (universeId: string, locations: Location[]): void =>
  set(KEYS.locations(universeId), locations);

// Timeline
export const getTimeline = (universeId: string): TimelineEvent[] => get<TimelineEvent>(KEYS.timeline(universeId));
export const saveTimelineEvent = (event: TimelineEvent): void => {
  const all = getTimeline(event.universe_id);
  const idx = all.findIndex(e => e.id === event.id);
  if (idx >= 0) all[idx] = event; else all.push(event);
  set(KEYS.timeline(event.universe_id), all);
};
export const deleteTimelineEvent = (universeId: string, id: string): void =>
  set(KEYS.timeline(universeId), getTimeline(universeId).filter(e => e.id !== id));
export const saveTimelineEvents = (universeId: string, events: TimelineEvent[]): void =>
  set(KEYS.timeline(universeId), events);

// Story Arcs
export const getArcs = (universeId: string): StoryArc[] => get<StoryArc>(KEYS.arcs(universeId));
export const saveArc = (arc: StoryArc): void => {
  const all = getArcs(arc.universe_id);
  const idx = all.findIndex(a => a.id === arc.id);
  if (idx >= 0) all[idx] = arc; else all.push(arc);
  set(KEYS.arcs(arc.universe_id), all);
};
export const deleteArc = (universeId: string, id: string): void =>
  set(KEYS.arcs(universeId), getArcs(universeId).filter(a => a.id !== id));
export const saveArcs = (universeId: string, arcs: StoryArc[]): void =>
  set(KEYS.arcs(universeId), arcs);

// Lore Rules
export const getLoreRules = (universeId: string): LoreRule[] => get<LoreRule>(KEYS.lore(universeId));
export const saveLoreRule = (rule: LoreRule): void => {
  const all = getLoreRules(rule.universe_id);
  const idx = all.findIndex(r => r.id === rule.id);
  if (idx >= 0) all[idx] = rule; else all.push(rule);
  set(KEYS.lore(rule.universe_id), all);
};
export const deleteLoreRule = (universeId: string, id: string): void =>
  set(KEYS.lore(universeId), getLoreRules(universeId).filter(r => r.id !== id));
export const saveLoreRules = (universeId: string, rules: LoreRule[]): void =>
  set(KEYS.lore(universeId), rules);

// Generated Stories
export const getStories = (universeId: string): GeneratedStory[] => get<GeneratedStory>(KEYS.stories(universeId));
export const saveStory = (story: GeneratedStory): void => {
  const all = getStories(story.universe_id);
  const idx = all.findIndex(s => s.id === story.id);
  if (idx >= 0) all[idx] = story; else all.push(story);
  set(KEYS.stories(story.universe_id), all);
};
export const deleteStory = (universeId: string, id: string): void =>
  set(KEYS.stories(universeId), getStories(universeId).filter(s => s.id !== id));

// Authored writing documents
export const getWritingDocuments = (projectId: string): WritingDocument[] =>
  get<WritingDocument>(KEYS.writingDocuments(projectId)).sort((a, b) => a.order - b.order);

export const saveWritingDocument = (document: WritingDocument): WritingDocument => {
  const all = getWritingDocuments(document.project_id);
  const idx = all.findIndex(item => item.id === document.id);
  const now = new Date().toISOString();
  const saved = { ...document, created_at: document.created_at || now, updated_at: now };
  if (idx >= 0) all[idx] = saved; else all.push(saved);
  set(KEYS.writingDocuments(document.project_id), all.sort((a, b) => a.order - b.order));
  return saved;
};

export const deleteWritingDocument = (projectId: string, id: string): void => {
  const all = getWritingDocuments(projectId);
  const descendants = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    all.forEach(item => {
      if (item.parent_id && descendants.has(item.parent_id) && !descendants.has(item.id)) {
        descendants.add(item.id);
        changed = true;
      }
    });
  }
  set(KEYS.writingDocuments(projectId), all.filter(item => !descendants.has(item.id)));
};

// Media Projects
export const getMediaProjects = (universeId: string): MediaProject[] => get<MediaProject>(KEYS.projects(universeId));
export const saveMediaProject = (project: MediaProject): void => {
  const all = getMediaProjects(project.universe_id);
  const idx = all.findIndex(p => p.id === project.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = { ...project, updated_at: now };
  } else {
    all.push({ ...project, updated_at: now });
  }
  set(KEYS.projects(project.universe_id), all);
};
export const deleteMediaProject = (universeId: string, id: string): void =>
  set(KEYS.projects(universeId), getMediaProjects(universeId).filter(p => p.id !== id));

// ─────────────────────────────────────────────────────────────────────────────
// Shared Lore Pool
// ─────────────────────────────────────────────────────────────────────────────

/** Return all entries in the shared lore pool. */
export const getSharedLorePool = (): SharedLoreEntry[] =>
  get<SharedLoreEntry>(KEYS.sharedLorePool);

/** Save (insert or update) a single shared lore entry. */
export const saveSharedLoreEntry = (entry: SharedLoreEntry): void => {
  const all = getSharedLorePool();
  const idx = all.findIndex(e => e.id === entry.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = { ...entry, updated_at: now };
  } else {
    all.push({ ...entry, updated_at: now });
  }
  set(KEYS.sharedLorePool, all);
};

/** Delete a shared lore entry by id. */
export const deleteSharedLoreEntry = (id: string): void =>
  set(KEYS.sharedLorePool, getSharedLorePool().filter(e => e.id !== id));

/** Check whether a source entity already has a pool entry. */
export const getSharedLoreEntryBySourceId = (sourceId: string): SharedLoreEntry | undefined =>
  getSharedLorePool().find(e => e.source_id === sourceId);

// ─────────────────────────────────────────────────────────────────────────────
// Scenes
// ─────────────────────────────────────────────────────────────────────────────

export const getScenes = (projectId: string): Scene[] => get<Scene>(KEYS.scenes(projectId));

export const saveScene = (scene: Scene): void => {
  const all = getScenes(scene.project_id);
  const idx = all.findIndex(s => s.id === scene.id);
  const now = new Date().toISOString();
  const updatedScene = { ...scene, updated_at: now, created_at: scene.created_at || now };
  if (idx >= 0) {
    all[idx] = updatedScene;
  } else {
    all.push(updatedScene);
  }
  // Sort scenes by order field
  all.sort((a, b) => a.order - b.order);
  set(KEYS.scenes(scene.project_id), all);
};

export const deleteScene = (projectId: string, id: string): void =>
  set(KEYS.scenes(projectId), getScenes(projectId).filter(s => s.id !== id));

// ─────────────────────────────────────────────────────────────────────────────
// Storyboard Panels
// ─────────────────────────────────────────────────────────────────────────────

export const getStoryboardPanels = (sceneId: string): StoryboardPanel[] => get<StoryboardPanel>(KEYS.storyboardPanels(sceneId));

export const saveStoryboardPanel = (panel: StoryboardPanel): void => {
  const all = getStoryboardPanels(panel.scene_id);
  const idx = all.findIndex(p => p.id === panel.id);
  const now = new Date().toISOString();
  const updatedPanel = { ...panel, updated_at: now, created_at: panel.created_at || now };
  if (idx >= 0) {
    all[idx] = updatedPanel;
  } else {
    all.push(updatedPanel);
  }
  // Sort panels by panel_number field
  all.sort((a, b) => a.panel_number - b.panel_number);
  set(KEYS.storyboardPanels(panel.scene_id), all);
};

export const deleteStoryboardPanel = (sceneId: string, id: string): void =>
  set(KEYS.storyboardPanels(sceneId), getStoryboardPanels(sceneId).filter(p => p.id !== id));


// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface LegacyDataStats {
  hasLegacyData: boolean;
  projectCount: number;
  characterCount: number;
  factionCount: number;
  locationCount: number;
  timelineCount: number;
  arcCount: number;
  ruleCount: number;
  storyCount: number;
  sceneCount: number;
  storyboardCount: number;
}

export const detectLegacyData = (): LegacyDataStats => {
  if (typeof window === 'undefined') {
    return {
      hasLegacyData: false,
      projectCount: 0,
      characterCount: 0,
      factionCount: 0,
      locationCount: 0,
      timelineCount: 0,
      arcCount: 0,
      ruleCount: 0,
      storyCount: 0,
      sceneCount: 0,
      storyboardCount: 0,
    };
  }

  let projectsRaw = '';
  const projectKeys = ['phoenix_projects', 'saga_universes'];
  for (const k of projectKeys) {
    const raw = localStorage.getItem(k);
    if (raw && JSON.parse(raw || '[]').length > 0) {
      projectsRaw = raw;
      break;
    }
  }

  if (!projectsRaw) {
    return {
      hasLegacyData: false,
      projectCount: 0,
      characterCount: 0,
      factionCount: 0,
      locationCount: 0,
      timelineCount: 0,
      arcCount: 0,
      ruleCount: 0,
      storyCount: 0,
      sceneCount: 0,
      storyboardCount: 0,
    };
  }

  let localProjects: { id: string }[] = [];
  try {
    localProjects = JSON.parse(projectsRaw);
  } catch {
    return {
      hasLegacyData: false,
      projectCount: 0,
      characterCount: 0,
      factionCount: 0,
      locationCount: 0,
      timelineCount: 0,
      arcCount: 0,
      ruleCount: 0,
      storyCount: 0,
      sceneCount: 0,
      storyboardCount: 0,
    };
  }

  let characterCount = 0;
  let factionCount = 0;
  let locationCount = 0;
  let timelineCount = 0;
  let arcCount = 0;
  let ruleCount = 0;
  let storyCount = 0;
  let sceneCount = 0;
  let storyboardCount = 0;

  localProjects.forEach(proj => {
    const uid = proj.id;
    
    const getCount = (prefix: string) => {
      const keys = [`phoenix_${prefix}_${uid}`, `saga_${prefix}_${uid}`];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            return JSON.parse(raw).length;
          } catch {}
        }
      }
      return 0;
    };

    characterCount += getCount('characters');
    factionCount += getCount('factions');
    locationCount += getCount('locations');
    timelineCount += getCount('timeline');
    arcCount += getCount('arcs');
    ruleCount += getCount('lore');
    storyCount += getCount('stories');
    
    let scenesLength = 0;
    const sceneKeys = [`phoenix_scenes_${uid}`, `saga_scenes_${uid}`];
    for (const k of sceneKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const list = JSON.parse(raw);
          scenesLength = list.length;
          sceneCount += scenesLength;
          list.forEach((sc: { id: string }) => {
            const sid = sc.id;
            const panelKeys = [`phoenix_storyboard_panels_${sid}`, `saga_storyboard_panels_${sid}`];
            for (const pk of panelKeys) {
              const drawRaw = localStorage.getItem(pk);
              if (drawRaw) {
                try {
                  storyboardCount += JSON.parse(drawRaw).length;
                  break;
                } catch {}
              }
            }
          });
          break;
        } catch {}
      }
    }
  });

  return {
    hasLegacyData: localProjects.length > 0,
    projectCount: localProjects.length,
    characterCount,
    factionCount,
    locationCount,
    timelineCount,
    arcCount,
    ruleCount,
    storyCount,
    sceneCount,
    storyboardCount,
  };
};

export const renameLocalStorageKeysPostMigration = (): void => {
  if (typeof window === 'undefined') return;

  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `phoenix_migrated_${yyyymmdd}_`;

  const keysToRename = [
    'phoenix_projects',
    'saga_universes',
    'phoenix_shared_lore_pool',
    'saga_shared_lore_pool'
  ];

  const projectsRaw = localStorage.getItem('phoenix_projects') || localStorage.getItem('saga_universes');
  if (projectsRaw) {
    try {
      const list = JSON.parse(projectsRaw);
      list.forEach((proj: { id: string }) => {
        const uid = proj.id;
        keysToRename.push(`phoenix_characters_${uid}`);
        keysToRename.push(`saga_characters_${uid}`);
        keysToRename.push(`phoenix_factions_${uid}`);
        keysToRename.push(`saga_factions_${uid}`);
        keysToRename.push(`phoenix_locations_${uid}`);
        keysToRename.push(`saga_locations_${uid}`);
        keysToRename.push(`phoenix_timeline_${uid}`);
        keysToRename.push(`saga_timeline_${uid}`);
        keysToRename.push(`phoenix_arcs_${uid}`);
        keysToRename.push(`saga_arcs_${uid}`);
        keysToRename.push(`phoenix_lore_${uid}`);
        keysToRename.push(`saga_lore_${uid}`);
        keysToRename.push(`phoenix_stories_${uid}`);
        keysToRename.push(`saga_stories_${uid}`);
        keysToRename.push(`phoenix_projects_${uid}`);
        keysToRename.push(`saga_projects_${uid}`);
        keysToRename.push(`phoenix_scenes_${uid}`);
        keysToRename.push(`saga_scenes_${uid}`);

        const rawScenes = localStorage.getItem(`phoenix_scenes_${uid}`) || localStorage.getItem(`saga_scenes_${uid}`);
        if (rawScenes) {
          try {
            const scenesList = JSON.parse(rawScenes);
            scenesList.forEach((sc: { id: string }) => {
              keysToRename.push(`phoenix_storyboard_panels_${sc.id}`);
              keysToRename.push(`saga_storyboard_panels_${sc.id}`);
            });
          } catch {}
        }
      });
    } catch {}
  }

  keysToRename.forEach(k => {
    const val = localStorage.getItem(k);
    if (val) {
      localStorage.setItem(`${prefix}${k}`, val);
      localStorage.removeItem(k);
    }
  });
};



