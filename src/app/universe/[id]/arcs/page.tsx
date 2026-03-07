'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { ArcCard } from '@/components/arc/ArcCard';
import { ArcForm } from '@/components/arc/ArcForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getArcs, saveArc, deleteArc, saveArcs, getUniverseById, getCharacters, getFactions } from '@/lib/storage';
import type { StoryArc, ArcType } from '@/lib/types';

const ARC_TYPE_CARDS: { type: ArcType; label: string; icon: string; desc: string }[] = [
  { type: 'trilogy', label: 'Trilogy Arc', icon: '📚', desc: 'Three-part saga spanning a complete world transformation' },
  { type: 'season', label: 'Season Arc', icon: '🎬', desc: 'Multi-episode story with clear beginning and end' },
  { type: 'hero', label: 'Single Hero Arc', icon: '⚡', desc: 'One character\'s journey from origin to destiny' },
  { type: 'villain', label: 'Villain Arc', icon: '👁️', desc: 'Antagonist\'s rise, reign, and inevitable confrontation' },
  { type: 'redemption', label: 'Redemption Arc', icon: '✨', desc: 'A broken soul\'s path back to the light' },
  { type: 'war', label: 'War Arc', icon: '⚔️', desc: 'Conflict on a massive scale that reshapes the world' },
  { type: 'prophecy', label: 'Prophecy Arc', icon: '🔮', desc: 'Destiny, chosen ones, and what fate truly means' },
  { type: 'empire_fall', label: 'Empire Fall', icon: '🏚️', desc: 'The collapse of a great power and its aftermath' },
];

interface ArcsPageProps {
  params: Promise<{ id: string }>;
}

export default function ArcsPage({ params }: ArcsPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedArcType, setSelectedArcType] = useState<ArcType>('hero');

  useEffect(() => {
    const u = getUniverseById(id);
    if (!u) { router.push('/dashboard'); return; }
    setArcs(getArcs(id));
    setLoading(false);
  }, [id, router]);

  const handleDelete = (arcId: string) => {
    deleteArc(id, arcId);
    setArcs(prev => prev.filter(a => a.id !== arcId));
  };

  const handleSave = (data: Omit<StoryArc, 'id'>) => {
    const arc: StoryArc = { ...data, id: crypto.randomUUID() };
    saveArc(arc);
    setArcs(prev => [...prev, arc]);
    setShowForm(false);
  };

  const handleGenerate = async (arcType: ArcType) => {
    setGenerating(true);
    try {
      const universe = getUniverseById(id);
      const characters = getCharacters(id);
      const factions = getFactions(id);
      const res = await fetch('/api/generate/arc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe, characters, factions, arcType }),
      });
      const data = await res.json();
      if (data.arc) {
        const newArc: StoryArc = {
          ...data.arc,
          id: crypto.randomUUID(),
          universe_id: id,
        };
        saveArc(newArc);
        setArcs(prev => [...prev, newArc]);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading arcs..." />
      </div>
    </Navigation>
  );

  return (
    <Navigation>
      <Header
        title="Arc Forge"
        subtitle={`${arcs.length} story arc${arcs.length !== 1 ? 's' : ''} in the canon`}
        actions={
          <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
            + Add Arc Manually
          </Button>
        }
      />

      <div className="px-6 py-6">
        {/* Arc Type Generator */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-[#c9a84c] mb-4 uppercase tracking-widest">Generate a Story Arc</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {ARC_TYPE_CARDS.map(at => (
              <button
                key={at.type}
                onClick={() => setSelectedArcType(at.type)}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                  selectedArcType === at.type
                    ? 'border-[#c9a84c] bg-[#c9a84c]/10 shadow-[0_0_15px_rgba(201,168,76,0.1)]'
                    : 'border-[#c9a84c]/20 hover:border-[#c9a84c]/50 bg-[#0f0f1a]'
                }`}
              >
                <span className="text-2xl">{at.icon}</span>
                <span className={`text-sm font-bold ${selectedArcType === at.type ? 'text-[#c9a84c]' : 'text-white'}`}>{at.label}</span>
                <span className="text-xs text-gray-500 leading-tight">{at.desc}</span>
              </button>
            ))}
          </div>
          <Button
            variant="gold"
            loading={generating}
            onClick={() => handleGenerate(selectedArcType)}
          >
            ✨ Generate {ARC_TYPE_CARDS.find(a => a.type === selectedArcType)?.label}
          </Button>
        </div>

        {/* Existing arcs */}
        {arcs.length > 0 && (
          <>
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest border-t border-[#c9a84c]/10 pt-6">
              Existing Arcs ({arcs.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {arcs.map(arc => (
                <ArcCard key={arc.id} arc={arc} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Story Arc" size="xl">
        <ArcForm
          universeId={id}
          selectedType={selectedArcType}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </Navigation>
  );
}
