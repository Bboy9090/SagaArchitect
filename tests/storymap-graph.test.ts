import { describe, expect, it } from 'vitest';
import { buildStoryMapGraph } from '../src/lib/storymap-graph';
import type { Character, Faction, TimelineEvent } from '../src/lib/types';

const character = (id: string, name: string, relationships: Character['relationships'] = []): Character => ({
  id,
  universe_id: 'u1',
  name,
  title: '',
  role: 'Hero',
  motivations: '',
  fears: '',
  powers: '',
  weaknesses: '',
  relationships,
  arc_potential: '',
  status: 'alive',
  canon_status: 'canon',
});

const faction = (id: string, name: string, allies: string[] = [], enemies: string[] = []): Faction => ({
  id,
  universe_id: 'u1',
  name,
  type: 'Order',
  ideology: '',
  leader: '',
  resources: '',
  allies,
  enemies,
  territory: '',
  internal_conflict: '',
  objective: '',
  canon_status: 'canon',
});

const event = (id: string, title: string, affectedCharacters: string[], affectedFactions: string[]): TimelineEvent => ({
  id,
  universe_id: 'u1',
  title,
  era_marker: 'Year 1',
  summary: '',
  affected_characters: affectedCharacters,
  affected_factions: affectedFactions,
  affected_locations: [],
  consequences: '',
  canon_status: 'canon',
});

describe('StoryMap graph', () => {
  it('links canonical character, faction and timeline references by id or name', () => {
    const graph = buildStoryMapGraph(
      [
        character('c1', 'Kai', [{ character_id: 'c2', character_name: 'Jax', type: 'sibling' }]),
        character('c2', 'Jax'),
      ],
      [faction('f1', 'Memory Keepers')],
      [event('e1', 'The Crossing', ['Kai'], ['Memory Keepers'])],
    );

    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges.some(edge => edge.label === 'sibling')).toBe(true);
    expect(graph.edges.filter(edge => edge.label === 'affects')).toHaveLength(2);
    expect(graph.unresolvedReferences).toEqual([]);
  });

  it('deduplicates mirrored faction relationships and reports unresolved references', () => {
    const graph = buildStoryMapGraph(
      [],
      [
        faction('f1', 'A', ['B'], ['Missing']),
        faction('f2', 'B', ['A']),
      ],
      [],
    );

    expect(graph.edges.filter(edge => edge.kind === 'faction_ally')).toHaveLength(1);
    expect(graph.unresolvedReferences).toEqual(['Faction enemy: A → Missing']);
  });
});
