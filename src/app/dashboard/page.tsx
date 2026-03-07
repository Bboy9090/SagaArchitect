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
  saveFactions, saveCharacters, saveLocations, saveTimelineEvents, saveArcs, saveLoreRules
} from '@/lib/storage';
import type { Universe } from '@/lib/types';
import {
  demoUniverse, demoFactions, demoCharacters, demoLocations,
  demoTimeline, demoArcs, demoLoreRules, DEMO_UNIVERSE_ID
} from '@/lib/demo-universe';

export default function DashboardPage() {
  const router = useRouter();
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [counts, setCounts] = useState<Record<string, { chars: number; factions: number; events: number }>>({});
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = getUniverses();
    setUniverses(all);
    const c: typeof counts = {};
    all.forEach(u => {
      c[u.id] = {
        chars: getCharacters(u.id).length,
        factions: getFactions(u.id).length,
        events: getTimeline(u.id).length,
      };
    });
    setCounts(c);
  }, []);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this universe and all its data?')) return;
    deleteUniverse(id);
    setUniverses(prev => prev.filter(u => u.id !== id));
    setCounts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleLoadDemo = () => {
    setLoadingDemo(true);
    setTimeout(() => {
      saveUniverse(demoUniverse);
      saveFactions(DEMO_UNIVERSE_ID, demoFactions);
      saveCharacters(DEMO_UNIVERSE_ID, demoCharacters);
      saveLocations(DEMO_UNIVERSE_ID, demoLocations);
      saveTimelineEvents(DEMO_UNIVERSE_ID, demoTimeline);
      saveArcs(DEMO_UNIVERSE_ID, demoArcs);
      saveLoreRules(DEMO_UNIVERSE_ID, demoLoreRules);
      setUniverses(getUniverses());
      setCounts(prev => ({
        ...prev,
        [DEMO_UNIVERSE_ID]: {
          chars: demoCharacters.length,
          factions: demoFactions.length,
          events: demoTimeline.length,
        }
      }));
      setLoadingDemo(false);
      router.push(`/universe/${DEMO_UNIVERSE_ID}`);
    }, 800);
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
        {/* Hero Header */}
        <div className="border-b border-[#c9a84c]/20 bg-gradient-to-r from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] px-8 py-10">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
              <span className="text-[#c9a84c]">SagaLore</span>Builder
            </h1>
            <p className="text-gray-400 text-lg">
              Build your universe bible. Track your canon. Generate your saga.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="gold"
                size="lg"
                onClick={() => router.push('/universe/new')}
              >
                ✨ Create New Universe
              </Button>
              <Button
                variant="secondary"
                size="lg"
                loading={loadingDemo}
                onClick={handleLoadDemo}
              >
                🌑 Load Demo: The Ashen Veil
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 py-8 max-w-5xl mx-auto">
          {universes.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-6">📜</div>
              <h2 className="text-2xl font-bold text-white mb-3">No Universes Yet</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Every great saga begins with a blank page. Forge your first universe — or explore the depths of the Ashen Veil.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="gold" size="lg" onClick={() => router.push('/universe/new')}>
                  ✨ Forge Your First Universe
                </Button>
                <Button variant="secondary" size="lg" loading={loadingDemo} onClick={handleLoadDemo}>
                  🌑 Load Demo Universe
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  Your Universes <span className="text-[#c9a84c]">({universes.length})</span>
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
    </Navigation>
  );
}
