'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { UniverseCard } from '@/components/universe/UniverseCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  getUniverses, saveUniverse, deleteUniverse,
  getFactions, getCharacters, getTimeline,
  saveFactions, saveCharacters, saveLocations, saveTimelineEvents, saveArcs, saveLoreRules,
  getLocations, getArcs, getLoreRules, getStories, getScenes, getStoryboardPanels,
  detectLegacyData, renameLocalStorageKeysPostMigration, type LegacyDataStats
} from '@/lib/storage';
import type { Universe, Faction, Character, Location, TimelineEvent, StoryArc, LoreRule, GeneratedStory, Scene, StoryboardPanel } from '@/lib/types';
import {
  demoUniverse, demoFactions, demoCharacters, demoLocations,
  demoTimeline, demoArcs, demoLoreRules, DEMO_UNIVERSE_ID
} from '@/lib/demo-universe';

// Storage mode helper & client
import { getStorageMode, setStorageMode, isDbMode } from '@/lib/storage-mode';
import { dbGetProjects, dbCreateProject, dbDeleteProject, dbGetCharacters, dbSaveCharacter } from '@/lib/db-client';
import { PhoenixBrand } from '@/components/brand/PhoenixBrand';

type DashboardState = {
  universes: Universe[];
  counts: Record<string, { chars: number; factions: number; events: number }>;
  mounted: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({ universes: [], counts: {}, mounted: false });
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [currentMode, setCurrentMode] = useState<'local' | 'db'>(() => getStorageMode());

  // Migration states
  const [legacyStats, setLegacyStats] = useState<LegacyDataStats | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStep, setMigrationStep] = useState<'idle' | 'preview' | 'importing' | 'completed'>('idle');
  const [previewResponse, setPreviewResponse] = useState<{
    stats: Record<string, number>;
    warnings: string[];
    conflicts: string[];
  } | null>(null);
  const [importResponse, setImportResponse] = useState<{
    imported: Record<string, number>;
    conflicts: number;
    warnings: number;
  } | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const { universes, counts, mounted } = state;

  const refreshDashboardData = async () => {
    const isDb = isDbMode();
    let all: Universe[] = [];
    if (isDb) {
      all = await dbGetProjects();
    } else {
      all = getUniverses();
    }

    const c: DashboardState['counts'] = {};
    for (const u of all) {
      if (isDb) {
        const dbChars = await dbGetCharacters(u.id);
        c[u.id] = {
          chars: dbChars.length,
          factions: getFactions(u.id).length,
          events: getTimeline(u.id).length,
        };
      } else {
        c[u.id] = {
          chars: getCharacters(u.id).length,
          factions: getFactions(u.id).length,
          events: getTimeline(u.id).length,
        };
      }
    }
    setState({ universes: all, counts: c, mounted: true });

    // Check for legacy storage data
    const stats = detectLegacyData();
    if (stats.hasLegacyData) {
      setLegacyStats(stats);
    } else {
      setLegacyStats(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleMode = (mode: 'local' | 'db') => {
    setStorageMode(mode);
    setCurrentMode(mode);
    refreshDashboardData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this universe and all its data?')) return;
    if (isDbMode()) {
      await dbDeleteProject(id);
    } else {
      deleteUniverse(id);
    }
    setState(prev => {
      const nextCounts = { ...prev.counts };
      delete nextCounts[id];
      return { ...prev, universes: prev.universes.filter(u => u.id !== id), counts: nextCounts };
    });
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    if (isDbMode()) {
      try {
        await dbCreateProject(demoUniverse);
        for (const char of demoCharacters) {
          await dbSaveCharacter(DEMO_UNIVERSE_ID, char);
        }
      } catch (err) {
        console.error(err);
      }
      refreshDashboardData();
      setLoadingDemo(false);
      router.push(`/universe/${DEMO_UNIVERSE_ID}`);
    } else {
      setTimeout(() => {
        saveUniverse(demoUniverse);
        saveFactions(DEMO_UNIVERSE_ID, demoFactions);
        saveCharacters(DEMO_UNIVERSE_ID, demoCharacters);
        saveLocations(DEMO_UNIVERSE_ID, demoLocations);
        saveTimelineEvents(DEMO_UNIVERSE_ID, demoTimeline);
        saveArcs(DEMO_UNIVERSE_ID, demoArcs);
        saveLoreRules(DEMO_UNIVERSE_ID, demoLoreRules);
        refreshDashboardData();
        setLoadingDemo(false);
        router.push(`/universe/${DEMO_UNIVERSE_ID}`);
      }, 800);
    }
  };

  const dumpLocalStorageData = () => {
    const localProjects = getUniverses();
    const characters: Character[] = [];
    const factions: Faction[] = [];
    const locations: Location[] = [];
    const timelineEvents: TimelineEvent[] = [];
    const storyArcs: StoryArc[] = [];
    const loreRules: LoreRule[] = [];
    const generatedStories: GeneratedStory[] = [];
    const scenes: Scene[] = [];
    const storyboardPanels: StoryboardPanel[] = [];

    localProjects.forEach(u => {
      const uid = u.id;
      characters.push(...getCharacters(uid));
      factions.push(...getFactions(uid));
      locations.push(...getLocations(uid));
      timelineEvents.push(...getTimeline(uid));
      storyArcs.push(...getArcs(uid));
      loreRules.push(...getLoreRules(uid));
      generatedStories.push(...getStories(uid));
      
      const scList = getScenes(uid);
      scenes.push(...scList);
      scList.forEach(sc => {
        storyboardPanels.push(...getStoryboardPanels(sc.id));
      });
    });

    return {
      projects: localProjects,
      characters,
      factions,
      locations,
      timelineEvents,
      storyArcs,
      loreRules,
      generatedStories,
      scenes,
      storyboardPanels,
    };
  };

  const triggerMigrationPreview = async () => {
    setIsMigrating(true);
    setMigrationStep('preview');
    setMigrationError(null);
    try {
      const payload = dumpLocalStorageData();
      const res = await fetch('/api/migration/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch migration preview');
      }
      setPreviewResponse({
        stats: data.stats,
        warnings: data.warnings || [],
        conflicts: data.conflicts || [],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An error occurred during preview generation';
      setMigrationError(msg);
    } finally {
      setIsMigrating(false);
    }
  };

  const executeMigrationImport = async () => {
    setIsMigrating(true);
    setMigrationStep('importing');
    setMigrationError(null);
    try {
      const payload = dumpLocalStorageData();
      const res = await fetch('/api/migration/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to execute database migration');
      }
      setImportResponse(data.report);
      setMigrationStep('completed');

      // Post-migration: safe rename of keys
      renameLocalStorageKeysPostMigration();
      refreshDashboardData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Migration transaction failed';
      setMigrationError(msg);
      setMigrationStep('preview');
    } finally {
      setIsMigrating(false);
    }
  };

  if (!mounted) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading archives..." />
      </div>
    </Navigation>
  );

  return (
    <Navigation>
      <div className="min-h-screen">
        {/* Legacy Storage Migration Banner */}
        {legacyStats && migrationStep === 'idle' && (
          <div className="bg-gradient-to-r from-[#1a1505] via-[#2a220a] to-[#1a1505] border-b border-[#c9a84c]/30 px-8 py-4">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💾</span>
                <div>
                  <h4 className="font-bold text-white text-sm md:text-base">
                    Local Storage Data Found ({legacyStats.projectCount} Projects)
                  </h4>
                  <p className="text-xs text-gray-300">
                    We found legacy offline projects containing {legacyStats.characterCount} characters, {legacyStats.sceneCount} scenes, and {legacyStats.storyboardCount} panels. Migrate them to PostgreSQL for persistent cloud storage.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="gold"
                  size="sm"
                  onClick={triggerMigrationPreview}
                >
                  🚀 Migrate to Database
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Studio Command Header */}
        <div className="border-b border-blue-400/15 bg-gradient-to-br from-[#07152e]/95 via-[#0b1024]/95 to-[#160c2f]/95 px-8 py-10 relative overflow-hidden">
          <div className="absolute inset-0 studio-grid opacity-50" />
          <div className="max-w-6xl mx-auto relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
              <div>
                <div className="mb-5 md:hidden"><PhoenixBrand /></div>
                <p className="text-[10px] font-black uppercase tracking-[.35em] text-blue-300/70 mb-3">Studio command center</p>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-[-.04em] max-w-3xl leading-[1.02]">
                  Turn your ideas into <span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">living productions.</span>
                </h1>
              </div>

              {/* Storage Mode Toggle Switcher */}
              <div className="bg-[#071020]/80 border border-blue-400/20 rounded-xl p-1 flex items-center gap-1 self-start md:self-auto backdrop-blur">
                <button
                  onClick={() => handleToggleMode('local')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                    currentMode === 'local'
                      ? 'bg-blue-400 text-[#03111f] font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Personal Vault
                </button>
                <button
                  onClick={() => handleToggleMode('db')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                    currentMode === 'db'
                      ? 'bg-violet-400 text-white font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Studio Cloud
                </button>
              </div>
            </div>
            <p className="text-blue-100/60 text-lg max-w-2xl mt-5 leading-relaxed">
              One production floor for novels, comics, screen stories, characters, worlds, storyboards, and release-ready assets.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="gold"
                size="lg"
                onClick={() => router.push('/universe/new')}
              >
                Start a New Production
              </Button>
              <Button
                variant="secondary"
                size="lg"
                loading={loadingDemo}
                onClick={handleLoadDemo}
              >
                Explore the Demo Studio
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 py-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
            {[
              ['✎', 'Stories', 'Books & scripts'],
              ['▤', 'Comics', 'Issues & panels'],
              ['▷', 'Screen', 'Scenes & shots'],
              ['◉', 'Characters', 'Cast & voices'],
              ['◇', 'Worlds', 'Canon & lore'],
              ['▦', 'Assets', 'Art & exports'],
            ].map(([icon, label, detail]) => (
              <div key={label} className="studio-panel rounded-xl p-4 hover:border-blue-300/30 transition-colors">
                <div className="text-xl text-blue-300 mb-3">{icon}</div>
                <div className="text-sm font-black text-white">{label}</div>
                <div className="text-[10px] text-slate-500 mt-1">{detail}</div>
              </div>
            ))}
          </div>
          {universes.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-6 text-blue-300">✦</div>
              <h2 className="text-2xl font-bold text-white mb-3">Your production slate is open</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Every studio begins with one brave idea. Start a production from scratch, or open the demo to tour the complete creative workflow.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="gold" size="lg" onClick={() => router.push('/universe/new')}>
                  Start Your First Production
                </Button>
                <Button variant="secondary" size="lg" loading={loadingDemo} onClick={handleLoadDemo}>
                  Tour Demo Studio
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  Production Slate <span className="text-blue-300">({universes.length})</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {universes.map(universe => (
                  <UniverseCard
                    key={universe.id}
                    universe={universe}
                    characterCount={counts[universe.id]?.chars ?? 0}
                    factionCount={counts[universe.id]?.factions ?? 0}
                    eventCount={counts[universe.id]?.events ?? 0}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Migration Wizard Modal */}
      {migrationStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-[#0d0d12] border border-[#c9a84c]/30 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="border-b border-[#c9a84c]/20 bg-gradient-to-r from-[#111] to-[#0c0c10] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⛓️</span>
                <h3 className="text-xl font-bold text-white">PostgreSQL Database Migration</h3>
              </div>
              {migrationStep !== 'importing' && (
                <button
                  onClick={() => setMigrationStep('idle')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {migrationError && (
                <div className="bg-red-950/50 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm">
                  <h4 className="font-bold mb-1">Migration Warning / Error</h4>
                  <p>{migrationError}</p>
                </div>
              )}

              {migrationStep === 'preview' && (
                <>
                  {isMigrating ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Spinner text="Analyzing legacy assets & structure..." />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        Below is a list of creative assets staged for import. All original localStorage keys will be safely backed up and renamed after success.
                      </p>

                      {previewResponse && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(previewResponse.stats).map(([k, count]) => (
                            <div key={k} className="bg-[#121217] border border-[#c9a84c]/10 rounded-lg p-3">
                              <div className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</div>
                              <div className="text-xl font-black text-white">{count}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {previewResponse && previewResponse.warnings.length > 0 && (
                        <div className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-4 text-amber-200 text-xs space-y-1 max-h-40 overflow-y-auto">
                          <h5 className="font-bold text-sm text-amber-400">Execution Warnings ({previewResponse.warnings.length})</h5>
                          <ul className="list-disc list-inside space-y-1">
                            {previewResponse.warnings.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="bg-[#15151e] border border-[#c9a84c]/20 rounded-lg p-4 flex gap-3 text-xs text-gray-400">
                        <span className="text-amber-500 text-base">⚠️</span>
                        <p>
                          <strong>Transaction Safe:</strong> The import operates inside a Postgres transaction. If any sub-entity insertion fails, all modifications will rollback automatically.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {migrationStep === 'importing' && (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Spinner text="Performing atomic Postgres insertions..." />
                  <p className="text-xs text-gray-500">Writing relational entities, remapping keys...</p>
                </div>
              )}

              {migrationStep === 'completed' && importResponse && (
                <div className="space-y-6">
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-5 text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <h4 className="text-lg font-bold text-white mb-1">Migration Successful!</h4>
                    <p className="text-xs text-emerald-300">
                      All assets have been successfully persisted to PostgreSQL under Creator ID: <code className="bg-black/40 px-1 py-0.5 rounded">11111111-1111-4111-8111-111111111111</code>.
                    </p>
                  </div>

                  <h5 className="font-bold text-sm text-white">Import Summary Report:</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(importResponse.imported).map(([k, count]) => (
                      <div key={k} className="bg-[#121217] border border-emerald-500/10 rounded-lg p-3">
                        <div className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</div>
                        <div className="text-xl font-black text-emerald-400">{count}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#15151e] border border-[#c9a84c]/20 rounded-lg p-4 text-xs text-gray-400">
                    <p className="mb-2"><strong>Safety Renaming Done:</strong></p>
                    <p>
                      Your browser local storage keys have been renamed using prefix <code>phoenix_migrated_...</code> to prevent collision. The dashboard will continue displaying local data only until Phase 2C DB-backed reads are fully deployed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#c9a84c]/20 bg-gradient-to-r from-[#0c0c10] to-[#111] px-6 py-4 flex items-center justify-end gap-3">
              {migrationStep === 'preview' && (
                <>
                  <Button
                    variant="secondary"
                    disabled={isMigrating}
                    onClick={() => setMigrationStep('idle')}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="gold"
                    disabled={isMigrating || !previewResponse}
                    onClick={executeMigrationImport}
                  >
                    Confirm & Start Import
                  </Button>
                </>
              )}

              {migrationStep === 'completed' && (
                <Button
                  variant="gold"
                  onClick={() => setMigrationStep('idle')}
                >
                  Close & Refresh Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Navigation>
  );
}
