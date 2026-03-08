'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { LocationCard } from '@/components/location/LocationCard';
import { ShareAsArchetypeButton } from '@/components/shared-lore/ShareAsArchetypeButton';
import {
  getUniverseById, getFactions, getCharacters, getLocations,
  getTimeline, getArcs, getLoreRules,
  saveLocations, saveCharacters, saveFactions
} from '@/lib/storage';
import { buildRainstormsSyncPayload, syncToRainstorms, pingRainstorms } from '@/lib/rainstorms';
import type { Universe, Faction, Character, Location } from '@/lib/types';

interface Section {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

interface CanonPageProps {
  params: Promise<{ id: string }>;
}

const RAINSTORMS_URL_KEY = 'loreengine_rainstorms_url';

export default function CanonCorePage({ params }: CanonPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ chars: 0, factions: 0, locations: 0, events: 0, arcs: 0, lore: 0 });
  const [locations, setLocations] = useState<Location[]>([]);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);

  // Rainstorms sync state
  const [showRainstormsModal, setShowRainstormsModal] = useState(false);
  const [rainstormsUrl, setRainstormsUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pinging' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [pingOk, setPingOk] = useState<boolean | null>(null);

  useEffect(() => {
    const u = getUniverseById(id);
    if (!u) { router.push('/dashboard'); return; }
    setUniverse(u);
    const locs = getLocations(id);
    setLocations(locs);
    setStats({
      chars: getCharacters(id).length,
      factions: getFactions(id).length,
      locations: locs.length,
      events: getTimeline(id).length,
      arcs: getArcs(id).length,
      lore: getLoreRules(id).length,
    });
    // Restore saved Rainstorms URL
    const saved = localStorage.getItem(RAINSTORMS_URL_KEY);
    if (saved) setRainstormsUrl(saved);
    setLoading(false);
  }, [id, router]);

  const toggleSection = (sectionId: string) => {
    setExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  /** Build a full canon block payload — used for all AI generation calls */
  const buildCanonPayload = () => {
    if (!universe) return {};
    return {
      universe,
      factions: getFactions(id),
      characters: getCharacters(id),
      locations: getLocations(id),
      timeline: getTimeline(id),
      lore_rules: getLoreRules(id),
      story_arcs: getArcs(id),
    };
  };

  /**
   * Export the universe as a raw LoreEngine payload — for Rainstorms or external tools.
   *
   * We export the raw CanonBlockInput (universe + entity arrays), NOT the processed
   * CanonBlock. This is the format Rainstorms POSTs to /api/lore-engine/canon-block
   * or /api/universes/{id}/story-context to receive a story context.
   *
   * Shape:
   *   { universe, factions[], characters[], locations[], timeline[], lore_rules[], story_arcs[] }
   *
   * Rainstorms then does:
   *   POST https://sagaarchitect.app/api/lore-engine/canon-block
   *   Content-Type: application/json
   *   Body: <exported JSON>
   *   → receives { canonBlock, promptContext, stats }
   */
  const handleExportCanon = async () => {
    if (!universe) return;
    const payload = buildCanonPayload();
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Sanitize filename: replace whitespace and any character not safe in filenames
      const safeName = universe.name.replace(/[^\w\-. ]/g, '').replace(/\s+/g, '_');
      a.download = `${safeName}_lore_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /** Open the Rainstorms sync modal, resetting previous sync state */
  const handleOpenRainstormsModal = () => {
    setSyncStatus('idle');
    setSyncMessage('');
    setPingOk(null);
    setShowRainstormsModal(true);
  };
  const handlePing = async () => {
    if (!rainstormsUrl.trim()) return;
    setSyncStatus('pinging');
    setPingOk(null);
    const result = await pingRainstorms(rainstormsUrl.trim());
    setPingOk(result.reachable);
    setSyncMessage(result.detail);
    setSyncStatus('idle');
  };

  /** Push this universe to the Rainstorms backend */
  const handleSyncToRainstorms = async () => {
    if (!universe || !rainstormsUrl.trim()) return;
    // Save URL for next time
    localStorage.setItem(RAINSTORMS_URL_KEY, rainstormsUrl.trim());
    setSyncStatus('syncing');
    setSyncMessage('');
    const payload = buildRainstormsSyncPayload(
      universe,
      getFactions(id),
      getCharacters(id),
      getLocations(id),
      getTimeline(id),
      getArcs(id),
      getLoreRules(id),
    );
    const result = await syncToRainstorms(rainstormsUrl.trim(), payload);
    setSyncStatus(result.success ? 'success' : 'error');
    setSyncMessage(result.message + (result.detail ? `\n\nDetail: ${result.detail}` : ''));
  };

  const generateLocations = async () => {
    if (!universe) return;
    setGenLoading('locations');
    try {
      const res = await fetch('/api/generate/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send full canon context so locations tie into existing lore
        body: JSON.stringify(buildCanonPayload()),
      });
      const data = await res.json();
      if (data.locations) {
        const newLocs: Location[] = data.locations.map((l: Omit<Location, 'id' | 'universe_id'>) => ({
          ...l,
          id: crypto.randomUUID(),
          universe_id: id,
        }));
        saveLocations(id, newLocs);
        setLocations(newLocs);
        setStats(prev => ({ ...prev, locations: newLocs.length }));
      }
    } finally {
      setGenLoading(null);
    }
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Opening archive..." />
      </div>
    </Navigation>
  );

  if (!universe) return null;

  const sections: Section[] = [
    {
      id: 'overview',
      icon: '🌍',
      title: 'World Overview',
      content: <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{universe.world_overview || 'No overview generated yet.'}</p>,
    },
    {
      id: 'myth',
      icon: '📜',
      title: 'Creation Myth',
      content: <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{universe.creation_myth || 'No creation myth yet.'}</p>,
    },
    {
      id: 'themes',
      icon: '🎭',
      title: 'Core Themes',
      content: (
        <div className="flex flex-wrap gap-2">
          {universe.themes?.length > 0
            ? universe.themes.map((t, i) => (
              <span key={i} className="text-sm bg-purple-900/20 border border-purple-500/20 rounded px-3 py-1 text-purple-300">{t}</span>
            ))
            : <p className="text-gray-500 text-sm">No themes defined.</p>
          }
        </div>
      ),
    },
    {
      id: 'conflict',
      icon: '⚡',
      title: 'Current Conflict',
      content: <p className="text-gray-300 text-sm leading-relaxed">{universe.current_conflict || 'No conflict defined.'}</p>,
    },
    {
      id: 'prophecy',
      icon: '🔮',
      title: 'Prophecy Hooks',
      content: (
        <ul className="space-y-2">
          {universe.prophecy_hooks?.length > 0
            ? universe.prophecy_hooks.map((p, i) => (
              <li key={i} className="text-gray-300 text-sm flex gap-2">
                <span className="text-[#c9a84c]/50 mt-0.5">◆</span>
                {p}
              </li>
            ))
            : <p className="text-gray-500 text-sm">No prophecy hooks defined.</p>
          }
        </ul>
      ),
    },
    {
      id: 'factions',
      icon: '🏛️',
      title: `Factions (${stats.factions})`,
      content: (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/factions`)}>
            View All Factions
          </Button>
          <Button
            variant="ghost" size="sm"
            loading={genLoading === 'factions'}
            onClick={async () => {
              setGenLoading('factions');
              try {
                const res = await fetch('/api/generate/factions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  // Send full canon context for consistent faction generation
                  body: JSON.stringify(buildCanonPayload()),
                });
                const data = await res.json();
                if (data.factions) {
                  saveFactions(id, data.factions.map((f: Omit<Faction, 'id' | 'universe_id'>) => ({
                    ...f, id: crypto.randomUUID(), universe_id: id,
                  })));
                  setStats(prev => ({ ...prev, factions: data.factions.length }));
                }
              } finally { setGenLoading(null); }
            }}
          >
            ✨ Generate
          </Button>
        </div>
      ),
    },
    {
      id: 'characters',
      icon: '👤',
      title: `Characters (${stats.chars})`,
      content: (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/characters`)}>
            View All Characters
          </Button>
          <Button
            variant="ghost" size="sm"
            loading={genLoading === 'characters'}
            onClick={async () => {
              setGenLoading('characters');
              try {
                const res = await fetch('/api/generate/characters', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  // Send full canon context for consistent character generation
                  body: JSON.stringify(buildCanonPayload()),
                });
                const data = await res.json();
                if (data.characters) {
                  saveCharacters(id, data.characters.map((c: Omit<Character, 'id' | 'universe_id'>) => ({
                    ...c, id: crypto.randomUUID(), universe_id: id,
                  })));
                  setStats(prev => ({ ...prev, chars: data.characters.length }));
                }
              } finally { setGenLoading(null); }
            }}
          >
            ✨ Generate
          </Button>
        </div>
      ),
    },
    {
      id: 'locations',
      icon: '📍',
      title: `Locations (${stats.locations})`,
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" loading={genLoading === 'locations'} onClick={generateLocations}>
              ✨ Generate Locations
            </Button>
          </div>
          {locations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {locations.map(loc => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  universeMeta={{ genre: universe.genre, tone: universe.tone, era: universe.era }}
                  onDelete={locId => {
                    setLocations(prev => prev.filter(l => l.id !== locId));
                    setStats(prev => ({ ...prev, locations: prev.locations - 1 }));
                    saveLocations(id, locations.filter(l => l.id !== locId));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'timeline',
      icon: '⏳',
      title: `Timeline (${stats.events} events)`,
      content: (
        <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/timeline`)}>
          View Full Timeline
        </Button>
      ),
    },
    {
      id: 'lore',
      icon: '⚡',
      title: `Lore Rules (${stats.lore})`,
      content: (
        <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/lore`)}>
          Open Lore Memory
        </Button>
      ),
    },
  ];

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';

  return (
    <Navigation>
      <Header
        title={universe.name}
        subtitle={`${universe.genre} · ${universe.tone} · ${universe.era}`}
        actions={
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="gold" size="sm" onClick={() => router.push(`/universe/${id}/stories`)}>
              📖 Story Forge
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={handleExportCanon}
            >
              {exportCopied ? '✓ Copied!' : '⚡ Export Canon'}
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={handleOpenRainstormsModal}
            >
              🌧 Sync to Rainstorms
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/arcs`)}>
              ⚔️ Arc Forge
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/lore`)}>
              🔮 Lore Memory
            </Button>
            <ShareAsArchetypeButton
              target={{ kind: 'universe', entity: universe }}
            />
          </div>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Meta info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Tech Level', value: universe.tech_level },
            { label: 'Magic System', value: universe.magic_system || 'None' },
            { label: 'Genre', value: universe.genre },
            { label: 'Tone', value: universe.tone },
          ].map(item => (
            <div key={item.label} className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-3">
              <p className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest">{item.label}</p>
              <p className="text-white text-sm font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8">
          {[
            { label: 'Characters', value: stats.chars, href: 'characters' },
            { label: 'Factions', value: stats.factions, href: 'factions' },
            { label: 'Locations', value: stats.locations, href: '' },
            { label: 'Events', value: stats.events, href: 'timeline' },
            { label: 'Arcs', value: stats.arcs, href: 'arcs' },
            { label: 'Lore Rules', value: stats.lore, href: 'lore' },
          ].map(stat => (
            <button
              key={stat.label}
              onClick={() => stat.href && router.push(`/universe/${id}/${stat.href}`)}
              className={`bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg p-3 text-center ${stat.href ? 'hover:border-[#c9a84c]/40 transition-colors cursor-pointer' : ''}`}
            >
              <div className="text-2xl font-bold text-[#c9a84c]">{stat.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest">{stat.label}</div>
            </button>
          ))}
        </div>

        {/* Expandable sections */}
        <div className="space-y-2">
          {sections.map(section => (
            <div key={section.id} className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#c9a84c]/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span>{section.icon}</span>
                  <span className="font-semibold text-white text-sm">{section.title}</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {expanded[section.id] ? '▲' : '▼'}
                </span>
              </button>
              {expanded[section.id] && (
                <div className="px-4 pb-4 pt-1 border-t border-[#c9a84c]/10">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sync to Rainstorms modal */}
      <Modal open={showRainstormsModal} onClose={() => setShowRainstormsModal(false)} title="Sync to Rainstorms" size="lg">
        <div className="space-y-4">
          {/* Explanation */}
          <div className="bg-[#0a0a0f] border border-[#c9a84c]/20 rounded-lg p-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              Push <span className="text-[#c9a84c] font-semibold">{universe.name}</span> — including all factions, characters, locations, timeline events, arcs, and lore rules — into the Rainstorms backend so it can generate canon-consistent stories from this universe.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Field mappings applied automatically: <code className="text-gray-500">tech_level → technology_level</code>, <code className="text-gray-500">themes[] → core_theme</code>
            </p>
          </div>

          {/* URL input */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Rainstorms Base URL
            </label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={rainstormsUrl}
                onChange={e => { setRainstormsUrl(e.target.value); setPingOk(null); setSyncMessage(''); }}
                placeholder="http://localhost:8001"
              />
              <Button
                variant="ghost"
                size="sm"
                loading={syncStatus === 'pinging'}
                onClick={handlePing}
                disabled={!rainstormsUrl.trim()}
              >
                Test
              </Button>
            </div>
            {pingOk === true && (
              <p className="text-xs text-green-400 mt-1">✓ Rainstorms is reachable</p>
            )}
            {pingOk === false && (
              <p className="text-xs text-red-400 mt-1">✗ Cannot reach Rainstorms — check URL and CORS</p>
            )}
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Factions', value: stats.factions },
              { label: 'Characters', value: stats.chars },
              { label: 'Locations', value: stats.locations },
              { label: 'Events', value: stats.events },
              { label: 'Arcs', value: stats.arcs },
              { label: 'Lore Rules', value: stats.lore },
            ].map(s => (
              <div key={s.label} className="bg-[#0f0f1a] border border-[#c9a84c]/10 rounded p-2">
                <div className="text-lg font-bold text-[#c9a84c]">{s.value}</div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Result message */}
          {syncMessage && (
            <div className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap ${
              syncStatus === 'success' ? 'bg-green-900/20 border border-green-500/20 text-green-300' : 'bg-red-900/20 border border-red-500/20 text-red-300'
            }`}>
              {syncMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="gold"
              loading={syncStatus === 'syncing'}
              disabled={!rainstormsUrl.trim() || syncStatus === 'pinging'}
              onClick={handleSyncToRainstorms}
            >
              {syncStatus === 'success' ? '✓ Synced!' : '🌧 Sync Universe to Rainstorms'}
            </Button>
            <Button variant="ghost" onClick={() => setShowRainstormsModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Navigation>
  );
}

