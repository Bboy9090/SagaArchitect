'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { UniverseForm } from '@/components/universe/UniverseForm';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { saveUniverse } from '@/lib/storage';
import type { Universe } from '@/lib/types';

interface GeneratedUniverse {
  world_overview: string;
  creation_myth: string;
  themes: string[];
  prophecy_hooks: string[];
  current_conflict: string;
}

export default function UniverseNewPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'loading' | 'review'>('form');
  const [formData, setFormData] = useState<Partial<Universe>>({});
  const [generated, setGenerated] = useState<GeneratedUniverse | null>(null);
  const [loadingText, setLoadingText] = useState('Forging your universe...');

  const cinemaTexts = [
    'Forging your universe...',
    'Weaving the world fabric...',
    'Inscribing the creation myth...',
    'Setting the factions in motion...',
    'Lighting the first conflict...',
    'Opening the forbidden archive...',
  ];

  const handleFormSubmit = async (data: Omit<Universe, 'id' | 'created_at' | 'updated_at' | 'world_overview' | 'creation_myth' | 'themes' | 'prophecy_hooks'>) => {
    setFormData(data);
    setStep('loading');

    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % cinemaTexts.length;
      setLoadingText(cinemaTexts[idx]);
    }, 1500);

    try {
      const res = await fetch('/api/generate/universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      setGenerated(result);
      setStep('review');
    } catch {
      setGenerated({
        world_overview: `${data.name} is a world shaped by ${data.concept}`,
        creation_myth: `In the beginning, the forces of ${data.genre} shaped this world...`,
        themes: ['Power and consequence', 'Identity', 'Legacy'],
        prophecy_hooks: ['The chosen one walks among them unrecognized.'],
        current_conflict: data.current_conflict || 'A great power struggles for dominance.',
      });
      setStep('review');
    } finally {
      clearInterval(interval);
    }
  };

  const handleSave = () => {
    if (!generated || !formData) return;
    const id = crypto.randomUUID();
    const universe: Universe = {
      id,
      name: formData.name ?? '',
      concept: formData.concept ?? '',
      genre: formData.genre ?? '',
      tone: formData.tone ?? '',
      era: formData.era ?? '',
      tech_level: formData.tech_level ?? '',
      magic_system: formData.magic_system ?? '',
      current_conflict: formData.current_conflict ?? generated.current_conflict,
      world_overview: generated.world_overview,
      creation_myth: generated.creation_myth,
      themes: generated.themes,
      prophecy_hooks: generated.prophecy_hooks,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveUniverse(universe);
    router.push(`/universe/${id}`);
  };

  return (
    <Navigation>
      <Header
        title="Universe Forge"
        subtitle="Shape a new world from the void"
      />
      <div className="max-w-3xl mx-auto px-6 py-8">
        {step === 'form' && (
          <div>
            <div className="mb-6 p-4 bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg">
              <p className="text-gray-400 text-sm">
                Fill in the core details of your universe. Our AI will generate a full world overview, creation myth, themes, and prophecy hooks.
              </p>
            </div>
            <UniverseForm onSubmit={handleFormSubmit} />
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-32">
            <Spinner size="lg" text={loadingText} />
            <p className="text-gray-600 text-xs mt-6 tracking-widest uppercase">
              Consulting the archive...
            </p>
          </div>
        )}

        {step === 'review' && generated && (
          <div className="space-y-6">
            <div className="p-4 bg-[#c9a84c]/5 border border-[#c9a84c]/30 rounded-lg">
              <p className="text-[#c9a84c] text-sm font-medium mb-1">✅ Universe Generated</p>
              <p className="text-gray-400 text-sm">Review the generated content below, then save to open your Canon Core.</p>
            </div>

            <Section title="🌍 World Overview" content={generated.world_overview} />
            <Section title="📜 Creation Myth" content={generated.creation_myth} />

            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-4">
              <h3 className="text-sm font-bold text-[#c9a84c] mb-3">🎭 Core Themes</h3>
              <div className="flex flex-wrap gap-2">
                {generated.themes.map((t, i) => (
                  <span key={i} className="text-sm bg-purple-900/20 border border-purple-500/20 rounded px-3 py-1 text-purple-300">{t}</span>
                ))}
              </div>
            </div>

            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-4">
              <h3 className="text-sm font-bold text-[#c9a84c] mb-3">🔮 Prophecy Hooks</h3>
              <ul className="space-y-2">
                {generated.prophecy_hooks.map((p, i) => (
                  <li key={i} className="text-gray-300 text-sm flex gap-2">
                    <span className="text-[#c9a84c]/50 mt-0.5">◆</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="gold" size="lg" onClick={handleSave}>
                📖 Save & Open Canon Core
              </Button>
              <Button variant="ghost" onClick={() => setStep('form')}>
                ← Back to Form
              </Button>
            </div>
          </div>
        )}
      </div>
    </Navigation>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-4">
      <h3 className="text-sm font-bold text-[#c9a84c] mb-2">{title}</h3>
      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}
