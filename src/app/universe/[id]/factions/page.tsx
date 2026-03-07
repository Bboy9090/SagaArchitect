'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { FactionCard } from '@/components/faction/FactionCard';
import { FactionForm } from '@/components/faction/FactionForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getFactions, saveFaction, deleteFaction, saveFactions, getUniverseById } from '@/lib/storage';
import type { Faction } from '@/lib/types';

interface FactionsPageProps {
  params: Promise<{ id: string }>;
}

export default function FactionsPage({ params }: FactionsPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const u = getUniverseById(id);
    if (!u) { router.push('/dashboard'); return; }
    setFactions(getFactions(id));
    setLoading(false);
  }, [id, router]);

  const handleDelete = (factionId: string) => {
    deleteFaction(id, factionId);
    setFactions(prev => prev.filter(f => f.id !== factionId));
  };

  const handleSave = (data: Omit<Faction, 'id'>) => {
    const faction: Faction = { ...data, id: crypto.randomUUID() };
    saveFaction(faction);
    setFactions(prev => [...prev, faction]);
    setShowForm(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const universe = getUniverseById(id);
      const res = await fetch('/api/generate/factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe }),
      });
      const data = await res.json();
      if (data.factions) {
        const newFactions: Faction[] = data.factions.map((f: Omit<Faction, 'id' | 'universe_id'>) => ({
          ...f,
          id: crypto.randomUUID(),
          universe_id: id,
        }));
        saveFactions(id, newFactions);
        setFactions(newFactions);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading factions..." />
      </div>
    </Navigation>
  );

  return (
    <Navigation>
      <Header
        title="Faction Builder"
        subtitle={`${factions.length} faction${factions.length !== 1 ? 's' : ''} shaping this world`}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" loading={generating} onClick={handleGenerate}>
              ✨ Generate Factions
            </Button>
            <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
              + Add Faction
            </Button>
          </div>
        }
      />

      <div className="px-6 py-6">
        {factions.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏛️</div>
            <h3 className="text-xl font-bold text-white mb-2">No Factions Yet</h3>
            <p className="text-gray-500 mb-6">Power vacuums invite factions. Who will rise to fill them?</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="gold" onClick={() => setShowForm(true)}>+ Add Manually</Button>
              <Button variant="secondary" loading={generating} onClick={handleGenerate}>✨ Generate with AI</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {factions.map(faction => (
              <FactionCard key={faction.id} faction={faction} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Faction" size="lg">
        <FactionForm
          universeId={id}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </Navigation>
  );
}
