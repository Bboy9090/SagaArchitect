import type { Character, Faction, Location, TimelineEvent } from './types';

export type StoryMapNodeKind = 'character' | 'faction' | 'location' | 'event';
export type StoryMapEdgeKind =
  | 'character_relationship'
  | 'faction_ally'
  | 'faction_enemy'
  | 'event_character'
  | 'event_faction'
  | 'event_location';

export interface StoryMapNode {
  id: string;
  kind: StoryMapNodeKind;
  label: string;
  subtitle: string;
  canonStatus?: string;
}

export interface StoryMapEdge {
  id: string;
  source: string;
  target: string;
  kind: StoryMapEdgeKind;
  label: string;
}

export interface StoryMapGraph {
  nodes: StoryMapNode[];
  edges: StoryMapEdge[];
  unresolvedReferences: string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function buildResolver(items: Array<{ id: string; name: string }>) {
  const byId = new Map(items.map(item => [item.id, item.id]));
  const byName = new Map(items.map(item => [normalize(item.name), item.id]));
  return (reference: string): string | null =>
    byId.get(reference) ?? byName.get(normalize(reference)) ?? null;
}

function pushEdge(
  edges: StoryMapEdge[],
  dedupe: Set<string>,
  source: string,
  target: string,
  kind: StoryMapEdgeKind,
  label: string,
) {
  if (!source || !target || source === target) return;
  const directional =
    kind === 'character_relationship' ||
    kind === 'event_character' ||
    kind === 'event_faction' ||
    kind === 'event_location';
  const endpoints = directional ? [source, target] : [source, target].sort();
  const key = `${kind}:${endpoints[0]}:${endpoints[1]}:${label.toLowerCase()}`;
  if (dedupe.has(key)) return;
  dedupe.add(key);
  edges.push({
    id: key,
    source,
    target,
    kind,
    label,
  });
}

export function buildStoryMapGraph(
  characters: Character[],
  factions: Faction[],
  locations: Location[],
  events: TimelineEvent[],
): StoryMapGraph {
  const nodes: StoryMapNode[] = [
    ...characters.map(character => ({
      id: `character:${character.id}`,
      kind: 'character' as const,
      label: character.name,
      subtitle: character.title || character.role || 'Character',
      canonStatus: character.canon_status,
    })),
    ...factions.map(faction => ({
      id: `faction:${faction.id}`,
      kind: 'faction' as const,
      label: faction.name,
      subtitle: faction.type || faction.ideology || 'Faction',
      canonStatus: faction.canon_status,
    })),
    ...locations.map(location => ({
      id: `location:${location.id}`,
      kind: 'location' as const,
      label: location.name,
      subtitle: location.region || location.type || 'Location',
      canonStatus: location.canon_status,
    })),
    ...events.map(event => ({
      id: `event:${event.id}`,
      kind: 'event' as const,
      label: event.title,
      subtitle: event.era_marker || 'Timeline event',
      canonStatus: event.canon_status,
    })),
  ];

  const resolveCharacter = buildResolver(characters.map(item => ({ id: item.id, name: item.name })));
  const resolveFaction = buildResolver(factions.map(item => ({ id: item.id, name: item.name })));
  const resolveLocation = buildResolver(locations.map(item => ({ id: item.id, name: item.name })));
  const edges: StoryMapEdge[] = [];
  const dedupe = new Set<string>();
  const unresolved = new Set<string>();

  for (const character of characters) {
    for (const relationship of character.relationships || []) {
      const targetId = resolveCharacter(relationship.character_id || relationship.character_name);
      if (!targetId) {
        unresolved.add(`Character relationship: ${character.name} → ${relationship.character_name || relationship.character_id}`);
        continue;
      }
      pushEdge(
        edges,
        dedupe,
        `character:${character.id}`,
        `character:${targetId}`,
        'character_relationship',
        relationship.type,
      );
    }

    if (character.faction_id) {
      const factionId = resolveFaction(character.faction_id);
      if (factionId) {
        pushEdge(
          edges,
          dedupe,
          `character:${character.id}`,
          `faction:${factionId}`,
          'character_relationship',
          'member',
        );
      }
    }
  }

  for (const faction of factions) {
    for (const ally of faction.allies || []) {
      const targetId = resolveFaction(ally);
      if (!targetId) {
        unresolved.add(`Faction ally: ${faction.name} → ${ally}`);
        continue;
      }
      pushEdge(edges, dedupe, `faction:${faction.id}`, `faction:${targetId}`, 'faction_ally', 'ally');
    }
    for (const enemy of faction.enemies || []) {
      const targetId = resolveFaction(enemy);
      if (!targetId) {
        unresolved.add(`Faction enemy: ${faction.name} → ${enemy}`);
        continue;
      }
      pushEdge(edges, dedupe, `faction:${faction.id}`, `faction:${targetId}`, 'faction_enemy', 'enemy');
    }
  }

  for (const event of events) {
    for (const reference of event.affected_characters || []) {
      const characterId = resolveCharacter(reference);
      if (!characterId) {
        unresolved.add(`Timeline character: ${event.title} → ${reference}`);
        continue;
      }
      pushEdge(
        edges,
        dedupe,
        `event:${event.id}`,
        `character:${characterId}`,
        'event_character',
        'affects',
      );
    }
    for (const reference of event.affected_factions || []) {
      const factionId = resolveFaction(reference);
      if (!factionId) {
        unresolved.add(`Timeline faction: ${event.title} → ${reference}`);
        continue;
      }
      pushEdge(
        edges,
        dedupe,
        `event:${event.id}`,
        `faction:${factionId}`,
        'event_faction',
        'affects',
      );
    }
    for (const reference of event.affected_locations || []) {
      const locationId = resolveLocation(reference);
      if (!locationId) {
        unresolved.add(`Timeline location: ${event.title} → ${reference}`);
        continue;
      }
      pushEdge(
        edges,
        dedupe,
        `event:${event.id}`,
        `location:${locationId}`,
        'event_location',
        'affects',
      );
    }
  }

  return {
    nodes,
    edges,
    unresolvedReferences: [...unresolved].sort(),
  };
}
