'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { CharacterCard } from '@/components/character/CharacterCard';
import { CharacterForm } from '@/components/character/CharacterForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getCharacters, saveCharacter, deleteCharacter, saveCharacters, getUniverseById, getFactions } from '@/lib/storage';
import type { Character } from '@/lib/types';

interface CharactersPageProps {
  params: Promise<{ id: string }>;
}

export default function CharactersPage({ params }: CharactersPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const u = getUniverseById(id);
    if (!u) { router.push('/dashboard'); return; }
    setCharacters(getCharacters(id));
    setLoading(false);
  }, [id, router]);

  const handleDelete = (charId: string) => {
    deleteCharacter(id, charId);
    setCharacters(prev => prev.filter(c => c.id !== charId));
  };

  const handleSave = (data: Omit<Character, 'id'>) => {
    const character: Character = { ...data, id: crypto.randomUUID() };
    saveCharacter(character);
    setCharacters(prev => [...prev, character]);
    setShowForm(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const universe = getUniverseById(id);
      const factions = getFactions(id);
      const res = await fetch('/api/generate/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe, factions }),
      });
      const data = await res.json();
      if (data.characters) {
        const newChars: Character[] = data.characters.map((c: Omit<Character, 'id' | 'universe_id'>) => ({
          ...c,
          id: crypto.randomUUID(),
          universe_id: id,
        }));
        saveCharacters(id, newChars);
        setCharacters(newChars);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading characters..." />
      </div>
    </Navigation>
  );

  return (
    <Navigation>
      <Header
        title="Character Engine"
        subtitle={`${characters.length} character${characters.length !== 1 ? 's' : ''} in this universe`}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" loading={generating} onClick={handleGenerate}>
              ✨ Generate Characters
            </Button>
            <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
              + Add Character
            </Button>
          </div>
        }
      />

      <div className="px-6 py-6">
        {characters.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">👤</div>
            <h3 className="text-xl font-bold text-white mb-2">No Characters Yet</h3>
            <p className="text-gray-500 mb-6">Every story needs heroes, villains, and everyone in between.</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="gold" onClick={() => setShowForm(true)}>+ Add Manually</Button>
              <Button variant="secondary" loading={generating} onClick={handleGenerate}>✨ Generate with AI</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map(char => (
              <CharacterCard key={char.id} character={char} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Character" size="lg">
        <CharacterForm
          universeId={id}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </Navigation>
  );
}
