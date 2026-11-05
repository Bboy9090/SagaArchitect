'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { getArcs, getCharacters, getFactions, getLocations, getTimeline, getUniverseById } from '@/lib/storage';
import { buildStoryMapGraph, type StoryMapEdgeKind, type StoryMapNodeKind } from '@/lib/storymap-graph';
import type { Character, Faction, Location, StoryArc, TimelineEvent } from '@/lib/types';

interface StoryMapPageProps {
  params: Promise<{ id: string }>;
}

const WIDTH = 1760;
const COLUMN_X: Record<StoryMapNodeKind, number> = {
  character: 150,
  faction: 500,
  location: 860,
  arc: 1220,
  event: 1580,
};
const EDGE_STYLE: Record<StoryMapEdgeKind, { stroke: string; dash?: string }> = {
  character_relationship: { stroke: '#60a5fa' },
  faction_ally: { stroke: '#34d399' },
  faction_enemy: { stroke: '#fb7185', dash: '7 5' },
  event_character: { stroke: '#c084fc', dash: '4 4' },
  event_faction: { stroke: '#fbbf24', dash: '4 4' },
  event_location: { stroke: '#22d3ee', dash: '4 4' },
  arc_character: { stroke: '#f472b6', dash: '6 3' },
  arc_faction: { stroke: '#fb923c', dash: '6 3' },
  character_arc_line: { stroke: '#38bdf8', dash: '10 4' },
};

function nodeY(index: number, count: number, height: number) {
  if (count <= 1) return height / 2;
  const top = 85;
  const bottom = height - 70;
  return top + ((bottom - top) * index) / (count - 1);
}

export default function StoryMapPage({ params }: StoryMapPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCharacters, setShowCharacters] = useState(true);
  const [showFactions, setShowFactions] = useState(true);
  const [showLocations, setShowLocations] = useState(true);
  const [showArcs, setShowArcs] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showCharacterArcLines, setShowCharacterArcLines] = useState(true);
  const [showUnresolved, setShowUnresolved] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const universe = getUniverseById(id);
      if (!universe) {
        router.push('/dashboard');
        return;
      }
      setCharacters(getCharacters(id));
      setFactions(getFactions(id));
      setLocations(getLocations(id));
      setArcs(getArcs(id));
      setEvents(getTimeline(id));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id, router]);

  const graph = useMemo(
    () => buildStoryMapGraph(characters, factions, locations, arcs, events),
    [characters, factions, locations, arcs, events],
  );

  const visibleKinds = useMemo(() => new Set<StoryMapNodeKind>([
    ...(showCharacters ? ['character' as const] : []),
    ...(showFactions ? ['faction' as const] : []),
    ...(showLocations ? ['location' as const] : []),
    ...(showArcs ? ['arc' as const] : []),
    ...(showEvents ? ['event' as const] : []),
  ]), [showArcs, showCharacters, showEvents, showFactions, showLocations]);

  const visibleNodes = graph.nodes.filter(node => visibleKinds.has(node.kind));
  const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
  const visibleEdges = graph.edges.filter(
    edge =>
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target) &&
      (showCharacterArcLines || edge.kind !== 'character_arc_line'),
  );

  const byKind = {
    character: visibleNodes.filter(node => node.kind === 'character'),
    faction: visibleNodes.filter(node => node.kind === 'faction'),
    location: visibleNodes.filter(node => node.kind === 'location'),
    arc: visibleNodes.filter(node => node.kind === 'arc'),
    event: visibleNodes.filter(node => node.kind === 'event'),
  };
  const maxRows = Math.max(
    byKind.character.length,
    byKind.faction.length,
    byKind.location.length,
    byKind.arc.length,
    byKind.event.length,
    1,
  );
  const height = Math.max(640, 130 + maxRows * 92);

  const positions = new Map<string, { x: number; y: number }>();
  (Object.keys(byKind) as StoryMapNodeKind[]).forEach(kind => {
    byKind[kind].forEach((node, index) => {
      positions.set(node.id, {
        x: COLUMN_X[kind],
        y: nodeY(index, byKind[kind].length, height),
      });
    });
  });

  if (loading) {
    return (
      <Navigation>
        <div className="flex h-64 items-center justify-center">
          <Spinner text="Building StoryMap..." />
        </div>
      </Navigation>
    );
  }

  return (
    <Navigation>
      <Header
        title="StoryMap"
        subtitle="Canon relationships, character arc lines, faction ties, locations, and timeline participation"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/timeline`)}>
              Timeline
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}`)}>
              Canon Core
            </Button>
          </div>
        }
      />

      <div className="space-y-5 px-4 py-6 md:px-6">
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Characters', graph.nodes.filter(node => node.kind === 'character').length],
            ['Factions', graph.nodes.filter(node => node.kind === 'faction').length],
            ['Locations', graph.nodes.filter(node => node.kind === 'location').length],
            ['Story arcs', graph.nodes.filter(node => node.kind === 'arc').length],
            ['Timeline events', graph.nodes.filter(node => node.kind === 'event').length],
            ['Relationships', graph.edges.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-white/10 bg-[#0f0f1a] p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
              <div className="mt-1 text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap gap-3 rounded-lg border border-white/10 bg-[#0f0f1a] p-3 text-xs text-gray-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showCharacters} onChange={event => setShowCharacters(event.target.checked)} />
            Characters
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showFactions} onChange={event => setShowFactions(event.target.checked)} />
            Factions
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showLocations} onChange={event => setShowLocations(event.target.checked)} />
            Locations
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showArcs} onChange={event => setShowArcs(event.target.checked)} />
            Story arcs
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showEvents} onChange={event => setShowEvents(event.target.checked)} />
            Timeline events
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCharacterArcLines}
              onChange={event => setShowCharacterArcLines(event.target.checked)}
            />
            Character arc lines
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showUnresolved} onChange={event => setShowUnresolved(event.target.checked)} />
            Unresolved references
          </label>
        </section>

        <section className="overflow-auto rounded-xl border border-white/10 bg-[#080b12]">
          {visibleNodes.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-500">
              No StoryMap nodes are visible. Add canon entities or enable a node type.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${WIDTH} ${height}`}
              className="min-h-[640px] min-w-[1400px] w-full"
              role="img"
              aria-label="StoryMap canon relationship graph"
            >
              <defs>
                <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.35" />
                </filter>
              </defs>

              <text x={COLUMN_X.character} y="34" textAnchor="middle" fill="#93c5fd" fontSize="18" fontWeight="700">Characters</text>
              <text x={COLUMN_X.faction} y="34" textAnchor="middle" fill="#86efac" fontSize="18" fontWeight="700">Factions</text>
              <text x={COLUMN_X.location} y="34" textAnchor="middle" fill="#67e8f9" fontSize="18" fontWeight="700">Locations</text>
              <text x={COLUMN_X.arc} y="34" textAnchor="middle" fill="#f9a8d4" fontSize="18" fontWeight="700">Story Arcs</text>
              <text x={COLUMN_X.event} y="34" textAnchor="middle" fill="#d8b4fe" fontSize="18" fontWeight="700">Timeline</text>

              {visibleEdges.map(edge => {
                const source = positions.get(edge.source);
                const target = positions.get(edge.target);
                if (!source || !target) return null;
                const style = EDGE_STYLE[edge.kind];
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                return (
                  <g key={edge.id}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={style.stroke}
                      strokeWidth="2"
                      strokeDasharray={style.dash}
                      opacity="0.7"
                    />
                    <rect x={midX - 38} y={midY - 10} width="76" height="20" rx="8" fill="#080b12" opacity="0.9" />
                    <text x={midX} y={midY + 4} textAnchor="middle" fill={style.stroke} fontSize="10">
                      {edge.label}
                    </text>
                  </g>
                );
              })}

              {visibleNodes.map(node => {
                const position = positions.get(node.id);
                if (!position) return null;
                const fill = node.kind === 'character'
                  ? '#172554'
                  : node.kind === 'faction'
                    ? '#052e2b'
                    : node.kind === 'location'
                      ? '#083344'
                      : node.kind === 'arc'
                        ? '#4a044e'
                        : '#2e1065';
                const stroke = node.kind === 'character'
                  ? '#60a5fa'
                  : node.kind === 'faction'
                    ? '#34d399'
                    : node.kind === 'location'
                      ? '#22d3ee'
                      : node.kind === 'arc'
                        ? '#f472b6'
                        : '#c084fc';
                return (
                  <g key={node.id} transform={`translate(${position.x - 120} ${position.y - 32})`} filter="url(#node-shadow)">
                    <rect width="240" height="64" rx="12" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <text x="120" y="26" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="700">
                      {node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label}
                    </text>
                    <text x="120" y="45" textAnchor="middle" fill="#94a3b8" fontSize="10">
                      {node.subtitle.length > 38 ? `${node.subtitle.slice(0, 37)}…` : node.subtitle}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#0f0f1a] p-4">
            <h2 className="text-sm font-bold text-white">Relationship legend</h2>
            <div className="mt-3 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
              {Object.entries(EDGE_STYLE).map(([kind, style]) => (
                <div key={kind} className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-8" style={{ backgroundColor: style.stroke }} />
                  <span>{kind.replaceAll('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0f0f1a] p-4">
            <h2 className="text-sm font-bold text-white">Reference integrity</h2>
            <p className="mt-1 text-xs text-gray-500">
              StoryMap only draws references that resolve to canonical IDs or exact entity names.
            </p>
            {showUnresolved && graph.unresolvedReferences.length > 0 ? (
              <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-xs text-amber-300/80">
                {graph.unresolvedReferences.map(reference => <li key={reference}>• {reference}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-emerald-300/80">
                {graph.unresolvedReferences.length === 0
                  ? 'All graph references resolved.'
                  : `${graph.unresolvedReferences.length} unresolved reference(s) hidden.`}
              </p>
            )}
          </div>
        </section>
      </div>
    </Navigation>
  );
}
