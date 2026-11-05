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

const location = (id, name) => ({
  id,
  universe_id: 'u1',
  name,
  type: 'District',
  region: 'North',
  description: '',
  strategic_value: '',
  mythic_importance: '',
  canon_status: 'canon',
});

const arc = (id, title, involvedCharacters = [], involvedFactions = []) => ({
  id,
  universe_id: 'u1',
  title,
  type: 'hero',
  summary: '',
  start_point: '',
  end_point: '',
  involved_characters: involvedCharacters,
  involved_factions: involvedFactions,
  themes: [],
  canon_status: 'canon',
});

const event = (id, title, affectedCharacters, affectedFactions, affectedLocations = []) => ({
  id,
  universe_id: 'u1',
  title,
  era_marker: 'Year 1',
  summary: '',
  affected_characters: affectedCharacters,
  affected_factions: affectedFactions,
  affected_locations: affectedLocations,
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
    [location('l1', 'Memory Nexus')],
    [arc('a1', 'Memory Bond', ['Kai'], ['Memory Keepers'])],
    [event('e1', 'The Crossing', ['Kai'], ['Memory Keepers'], ['Memory Nexus'])],
  );

  assert.equal(graph.nodes.length, 6);
  assert.equal(graph.edges.some(edge => edge.label === 'sibling'), true);
  assert.equal(graph.edges.filter(edge => edge.label === 'affects').length, 3);
  assert.equal(graph.edges.filter(edge => edge.label === 'involves').length, 2);
  assert.equal(graph.edges.some(edge => edge.kind === 'event_location'), true);
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
    [],
    [],
  );

  assert.equal(graph.edges.filter(edge => edge.kind === 'faction_ally').length, 1);
  assert.deepEqual(graph.unresolvedReferences, ['Faction enemy: A → Missing']);
});

test('StoryMap reports unresolved timeline locations instead of inventing nodes', () => {
  const graph = buildStoryMapGraph(
    [],
    [],
    [location('l1', 'Known Place')],
    [],
    [event('e1', 'Unknown Crossing', [], [], ['Missing Place'])],
  );

  assert.equal(graph.nodes.filter(node => node.kind === 'location').length, 1);
  assert.equal(graph.edges.filter(edge => edge.kind === 'event_location').length, 0);
  assert.deepEqual(graph.unresolvedReferences, ['Timeline location: Unknown Crossing → Missing Place']);
});

test('StoryMap reports unresolved story arc references instead of inventing entities', () => {
  const graph = buildStoryMapGraph(
    [character('c1', 'Kai')],
    [],
    [],
    [arc('a1', 'Broken Arc', ['Kai', 'Missing Hero'], ['Missing Order'])],
    [],
  );

  assert.equal(graph.edges.filter(edge => edge.kind === 'arc_character').length, 1);
  assert.deepEqual(graph.unresolvedReferences, [
    'Story arc character: Broken Arc → Missing Hero',
    'Story arc faction: Broken Arc → Missing Order',
  ]);
});

