import type { Universe, Faction, Character, Location, TimelineEvent, StoryArc, LoreRule, GeneratedStory, MediaProject, SharedLoreEntry } from './types';

const KEYS = {
  universes: 'saga_universes',
  factions: (uid: string) => `saga_factions_${uid}`,
  characters: (uid: string) => `saga_characters_${uid}`,
  locations: (uid: string) => `saga_locations_${uid}`,
  timeline: (uid: string) => `saga_timeline_${uid}`,
  arcs: (uid: string) => `saga_arcs_${uid}`,
  lore: (uid: string) => `saga_lore_${uid}`,
  stories: (uid: string) => `saga_stories_${uid}`,
  projects: (uid: string) => `saga_projects_${uid}`,
  sharedLorePool: 'saga_shared_lore_pool',
};

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
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
