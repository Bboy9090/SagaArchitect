import test from 'node:test';
import assert from 'node:assert/strict';

const { buildStoryMapGraph } = await import('../src/lib/storymap-graph.ts');

const character = (id, name, relationships = []) => ({
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

const faction = (id, name, allies = [], enemies = []) => ({
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

const event = (id, title, affectedCharacters, affectedFactions) => ({
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

test('StoryMap links canonical character, faction and timeline references by id or name', () => {
  const graph = buildStoryMapGraph(
    [
      character('c1', 'Kai', [{ character_id: 'c2', character_name: 'Jax', type: 'sibling' }]),
      character('c2', 'Jax'),
    ],
    [faction('f1', 'Memory Keepers')],
    [event('e1', 'The Crossing', ['Kai'], ['Memory Keepers'])],
  );

  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.some(edge => edge.label === 'sibling'), true);
  assert.equal(graph.edges.filter(edge => edge.label === 'affects').length, 2);
  assert.deepEqual(graph.unresolvedReferences, []);
});

test('StoryMap deduplicates mirrored faction relationships and reports unresolved references', () => {
  const graph = buildStoryMapGraph(
    [],
    [
      faction('f1', 'A', ['B'], ['Missing']),
      faction('f2', 'B', ['A']),
    ],
    [],
  );

  assert.equal(graph.edges.filter(edge => edge.kind === 'faction_ally').length, 1);
  assert.deepEqual(graph.unresolvedReferences, ['Faction enemy: A → Missing']);
});
