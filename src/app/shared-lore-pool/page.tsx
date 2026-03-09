'use client';

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { SharedLoreCard } from '@/components/shared-lore/SharedLoreCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { getSharedLorePool, deleteSharedLoreEntry } from '@/lib/storage';
import type { SharedLoreEntry, SharedLoreSourceType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type GenerateType = 'character' | 'faction' | 'world_concept';

/** Fresh recombination seed — new unified output format */
interface FreshSeed {
  title: string;
  hook: string;
  inspiration_tags: string[];
}

interface GenerateResult {
  // New format (fresh_recombination)
  results?: FreshSeed[];
  generation_mode?: string;
  // Legacy format (worldbuilding)
  generated?: {
    characters?: Array<{ name: string; role: string; motivation: string; arc_potential: string; visual_description: string; tone_note: string }>;
    factions?: Array<{ name: string; type: string; ideology: string; objective: string; internal_tension: string; visual_description: string }>;
    world_concept?: { name: string; genre: string; tone: string; core_conflict: string; magic_or_tech_note: string; era: string; visual_description: string };
  };
  from_archetypes: string[];
  canon_safety_note: string;
}

const SOURCE_TYPE_OPTIONS: { value: '' | SharedLoreSourceType; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'character', label: '👤 Characters' },
  { value: 'faction', label: '🏛️ Factions' },
  { value: 'location', label: '📍 Locations' },
  { value: 'arc', label: '⚔️ Arcs' },
  { value: 'world_seed', label: '🌍 World Seeds' },
  { value: 'rule_set', label: '📜 Rule Sets' },
];

/** Canonical category labels — matches the category field set by the archetype engine */
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'hero archetype', label: '🦸 Hero Archetypes' },
  { value: 'villain archetype', label: '🦹 Villain Archetypes' },
  { value: 'faction type', label: '🏛️ Faction Types' },
  { value: 'location template', label: '📍 Location Templates' },
  { value: 'world theme', label: '🌍 World Themes' },
  { value: 'conflict pattern', label: '⚔️ Conflict Patterns' },
];

const GENRE_OPTIONS = ['', 'fantasy', 'sci-fi', 'horror', 'romance', 'thriller', 'historical', 'children'];
const TONE_OPTIONS = ['', 'dark', 'epic', 'dark epic', 'hopeful', 'tragic', 'lighthearted', 'mysterious'];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SharedLorePoolPage() {
  // Pool state
  const [poolEntries, setPoolEntries] = useState<SharedLoreEntry[]>([]);
  const [apiEntries, setApiEntries] = useState<Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'>[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSourceType, setFilterSourceType] = useState<'' | SharedLoreSourceType>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterTone, setFilterTone] = useState('');
  const [filterThemes, setFilterThemes] = useState('');

  // Generate panel
  const [showGenerate, setShowGenerate] = useState(false);
  const [genTypes, setGenTypes] = useState<GenerateType[]>(['character', 'faction']);
  const [genGenre, setGenGenre] = useState('fantasy');
  const [genTone, setGenTone] = useState('dark epic');
  const [genThemes, setGenThemes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);

  // Load local pool + API pool
  useEffect(() => {
    setPoolEntries(getSharedLorePool());
    fetchApiPool();
    setLoading(false);
  }, []);

  const fetchApiPool = async (params?: Record<string, string>) => {
    const url = new URL('/api/shared-lore-pool', window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json() as { entries: Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'>[] };
      setApiEntries(data.entries ?? []);
    }
  };

  const applyFilters = () => {
    const params: Record<string, string> = {};
    if (filterSourceType) params.source_type = filterSourceType;
    if (filterCategory) params.category = filterCategory;
    if (filterGenre) params.genre = filterGenre;
    if (filterTone) params.tone = filterTone;
    if (filterThemes.trim()) params.theme_tags = filterThemes.trim();
    fetchApiPool(params);
  };

  const handleDeleteLocal = (id: string) => {
    deleteSharedLoreEntry(id);
    setPoolEntries(prev => prev.filter(e => e.id !== id));
  };

  const toggleGenType = (t: GenerateType) => {
    setGenTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/shared-lore-pool/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use the new Lore Pool Engine body shape (fresh_recombination)
        body: JSON.stringify({
          filters: {
            genre: genGenre || undefined,
            tone: genTone || undefined,
            theme_tags: genThemes.trim()
              ? genThemes.split(',').map(t => t.trim()).filter(Boolean)
              : undefined,
          },
          count: 5,
          generation_mode: 'fresh_recombination',
        }),
      });
      const data = await res.json() as GenerateResult;
      setGenResult(data);
    } finally {
      setGenerating(false);
    }
  };

  // Merge local + API entries, dedup by id using a Set for O(n+m) performance
  const poolEntryIds = new Set(poolEntries.map(e => e.id));
  const allDisplayEntries: Array<Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'>> = [
    ...poolEntries,
    ...apiEntries.filter(ae => !poolEntryIds.has(ae.id)),
  ];

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading Shared Lore Pool..." />
      </div>
    </Navigation>
  );

  return (
    <Navigation>
      <Header
        title="Shared Lore Pool"
        subtitle={`${allDisplayEntries.length} archetype${allDisplayEntries.length !== 1 ? 's' : ''} available`}
        actions={
          <Button variant="gold" size="sm" onClick={() => { setShowGenerate(!showGenerate); setGenResult(null); }}>
            {showGenerate ? '✕ Close Generator' : '✨ Generate From Shared Lore'}
          </Button>
        }
      />

      <div className="px-6 py-4 space-y-6">

        {/* ── Generate From Shared Lore Panel ─────────────────────────────── */}
        {showGenerate && (
          <div className="bg-[#0f0f1a] border border-[#c9a84c]/30 rounded-lg p-5">
            <h2 className="text-[#c9a84c] font-bold mb-1">✨ Generate From Lore Pool</h2>
            <p className="text-gray-500 text-xs mb-4">
              Recombine shared archetype patterns into fresh original story seeds.
              Canon safety: no private lore is ever reproduced — only abstracted patterns.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest block mb-1">Genre</label>
                <select
                  value={genGenre}
                  onChange={e => setGenGenre(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
                >
                  {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g || 'Any'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest block mb-1">Tone</label>
                <select
                  value={genTone}
                  onChange={e => setGenTone(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
                >
                  {TONE_OPTIONS.map(t => <option key={t} value={t}>{t || 'Any'}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest block mb-1">
                Theme Tags (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. memory, sacrifice, legacy"
                value={genThemes}
                onChange={e => setGenThemes(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-3 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
              />
            </div>

            <Button
              variant="gold"
              size="sm"
              loading={generating}
              onClick={handleGenerate}
            >
              ✨ Generate From Lore Pool
            </Button>

            {/* ── Generation Result ──────────────────────────────────────── */}
            {genResult && (
              <div className="mt-5 space-y-4">
                <div className="bg-green-900/10 border border-green-500/20 rounded p-2 text-xs text-green-400">
                  🛡️ {genResult.canon_safety_note}
                </div>

                {genResult.from_archetypes.length > 0 && (
                  <div>
                    <p className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest mb-1">Inspired by archetypes</p>
                    <div className="flex flex-wrap gap-1">
                      {genResult.from_archetypes.map((a, i) => (
                        <span key={i} className="text-[10px] bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-0.5 text-[#c9a84c]/60">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── New format: fresh_recombination results ──────────────── */}
                {genResult.results && genResult.results.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold text-sm mb-3">✨ Generated Seeds</h3>
                    <div className="space-y-3">
                      {genResult.results.map((seed, i) => (
                        <div key={i} className="bg-[#1a1a2e] border border-[#c9a84c]/10 rounded-lg p-4">
                          <p className="text-white font-semibold text-sm mb-1">📖 {seed.title}</p>
                          <p className="text-gray-300 text-xs leading-relaxed mb-2">{seed.hook}</p>
                          <div className="flex flex-wrap gap-1">
                            {seed.inspiration_tags.map((tag, j) => (
                              <span key={j} className="text-[10px] bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-[#c9a84c]/70 rounded px-2 py-0.5">{tag}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Legacy format: characters / factions / world concept ── */}
                {genResult.generated && (
                  <>
                    {genResult.generated.characters && genResult.generated.characters.length > 0 && (
                      <div>
                        <h3 className="text-white font-bold text-sm mb-2">👤 Generated Characters</h3>
                        <div className="space-y-3">
                          {genResult.generated.characters.map((c, i) => (
                            <div key={i} className="bg-[#1a1a2e] border border-[#c9a84c]/10 rounded p-3">
                              <p className="text-white font-semibold text-sm">{c.name}</p>
                              <p className="text-[#c9a84c]/70 text-xs italic">{c.role}</p>
                              {c.motivation && <p className="text-gray-400 text-xs mt-1"><span className="text-[#c9a84c]/50">Motivation:</span> {c.motivation}</p>}
                              {c.arc_potential && <p className="text-gray-400 text-xs"><span className="text-[#c9a84c]/50">Arc:</span> {c.arc_potential}</p>}
                              {c.visual_description && <p className="text-gray-500 text-xs"><span className="text-[#c9a84c]/50">Visual:</span> {c.visual_description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {genResult.generated.factions && genResult.generated.factions.length > 0 && (
                      <div>
                        <h3 className="text-white font-bold text-sm mb-2">🏛️ Generated Factions</h3>
                        <div className="space-y-3">
                          {genResult.generated.factions.map((f, i) => (
                            <div key={i} className="bg-[#1a1a2e] border border-[#c9a84c]/10 rounded p-3">
                              <p className="text-white font-semibold text-sm">{f.name}</p>
                              <p className="text-[#c9a84c]/70 text-xs italic">{f.type}</p>
                              {f.ideology && <p className="text-gray-400 text-xs mt-1"><span className="text-[#c9a84c]/50">Ideology:</span> {f.ideology}</p>}
                              {f.objective && <p className="text-gray-400 text-xs"><span className="text-[#c9a84c]/50">Objective:</span> {f.objective}</p>}
                              {f.internal_tension && <p className="text-gray-500 text-xs"><span className="text-[#c41e3a]/50">Tension:</span> {f.internal_tension}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {genResult.generated.world_concept && (
                      <div>
                        <h3 className="text-white font-bold text-sm mb-2">🌍 Generated World Concept</h3>
                        <div className="bg-[#1a1a2e] border border-[#c9a84c]/10 rounded p-3 space-y-1">
                          <p className="text-white font-semibold text-sm">{genResult.generated.world_concept.name}</p>
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-[10px] bg-[#c9a84c]/10 text-[#c9a84c]/70 rounded px-2 py-0.5">{genResult.generated.world_concept.genre}</span>
                            <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-2 py-0.5">{genResult.generated.world_concept.tone}</span>
                            <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-2 py-0.5">{genResult.generated.world_concept.era}</span>
                          </div>
                          {genResult.generated.world_concept.core_conflict && <p className="text-gray-400 text-xs"><span className="text-[#c9a84c]/50">Core conflict:</span> {genResult.generated.world_concept.core_conflict}</p>}
                          {genResult.generated.world_concept.magic_or_tech_note && <p className="text-gray-400 text-xs"><span className="text-[#c9a84c]/50">Magic/Tech:</span> {genResult.generated.world_concept.magic_or_tech_note}</p>}
                          {genResult.generated.world_concept.visual_description && <p className="text-gray-500 text-xs"><span className="text-[#c9a84c]/50">Visual:</span> {genResult.generated.world_concept.visual_description}</p>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg p-4">
          <h2 className="text-white font-semibold text-sm mb-3">🔍 Filter Pool</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest block mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest block mb-1">Type</label>
              <select
                value={filterSourceType}
                onChange={e => setFilterSourceType(e.target.value as '' | SharedLoreSourceType)}
                className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
              >
                {SOURCE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest block mb-1">Genre</label>
              <select
                value={filterGenre}
                onChange={e => setFilterGenre(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
              >
                {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g || 'Any'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest block mb-1">Tone</label>
              <select
                value={filterTone}
                onChange={e => setFilterTone(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
              >
                {TONE_OPTIONS.map(t => <option key={t} value={t}>{t || 'Any'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest block mb-1">Themes</label>
              <input
                type="text"
                placeholder="memory, sacrifice..."
                value={filterThemes}
                onChange={e => setFilterThemes(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-1.5 text-gray-200 text-xs focus:border-[#c9a84c]/60 focus:outline-none"
              />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={applyFilters}>Apply Filters</Button>
        </div>

        {/* ── Pool entries (my shared + API seed pool) ─────────────────────── */}
        {poolEntries.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <span>🌐 My Shared Archetypes</span>
              <span className="text-gray-600 font-normal text-xs">({poolEntries.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {poolEntries.map(entry => (
                <SharedLoreCard
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDeleteLocal}
                  showDeleteButton
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span>🌍 Community Archetypes</span>
            <span className="text-gray-600 font-normal text-xs">({apiEntries.length})</span>
          </h2>

          {allDisplayEntries.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🌐</div>
              <h3 className="text-xl font-bold text-white mb-2">No Archetypes Yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Open any universe and use the{' '}
                <span className="text-[#c9a84c]">🌐 Share</span> button on characters, factions, arcs, or locations
                to contribute abstracted patterns to the pool.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apiEntries
                .filter(ae => !poolEntries.some(pe => pe.id === ae.id))
                .map(entry => (
                  <SharedLoreCard key={entry.id} entry={entry} />
                ))}
            </div>
          )}
        </section>
      </div>
    </Navigation>
  );
}
