'use client';

import { useState } from 'react';
import type { Universe } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type UniverseFormData = Omit<Universe, 'id' | 'created_at' | 'updated_at' | 'world_overview' | 'creation_myth' | 'themes' | 'prophecy_hooks'>;

interface UniverseFormProps {
  onSubmit: (data: UniverseFormData) => void;
  loading?: boolean;
}

const GENRES = ['Fantasy', 'Sci-Fi', 'Horror', 'Mythology', 'Dystopia', 'Alternate History', 'Space Opera', 'Dark Fantasy', 'Post-Apocalyptic', 'Steampunk', 'Cyberpunk'];
const TONES = ['Epic', 'Dark', 'Gritty', 'Hopeful', 'Tragic', 'Mythic', 'Cosmic Horror', 'Noir', 'Heroic', 'Melancholic', 'Triumphant'];
const TECH_LEVELS = ['Primitive', 'Ancient', 'Medieval', 'Renaissance', 'Industrial', 'Modern', 'Near Future', 'Post-Apocalyptic', 'Alien', 'Transhuman'];

export function UniverseForm({ onSubmit, loading = false }: UniverseFormProps) {
  const [formData, setFormData] = useState<UniverseFormData>({
    name: '',
    concept: '',
    genre: 'Fantasy',
    tone: 'Epic',
    era: '',
    tech_level: 'Medieval',
    magic_system: '',
    current_conflict: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/30 placeholder-gray-600';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelClass}>Universe Name *</label>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="e.g., The Ashen Veil"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>World Concept *</label>
        <textarea
          name="concept"
          value={formData.concept}
          onChange={handleChange}
          required
          rows={4}
          placeholder="Describe the core premise and world in a few sentences..."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Genre *</label>
          <select name="genre" value={formData.genre} onChange={handleChange} className={inputClass}>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Tone *</label>
          <select name="tone" value={formData.tone} onChange={handleChange} className={inputClass}>
            {TONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Era</label>
        <input
          name="era"
          value={formData.era}
          onChange={handleChange}
          placeholder='e.g., "Age of Ash — Post-War Reconstruction"'
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Technology Level</label>
        <select name="tech_level" value={formData.tech_level} onChange={handleChange} className={inputClass}>
          {TECH_LEVELS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClass}>Magic System</label>
        <input
          name="magic_system"
          value={formData.magic_system}
          onChange={handleChange}
          placeholder='e.g., "Blood-weaving — costs life force" or "None"'
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Core Conflict</label>
        <textarea
          name="current_conflict"
          value={formData.current_conflict}
          onChange={handleChange}
          rows={3}
          placeholder="What is the central struggle or tension in this world?"
          className={inputClass}
        />
      </div>

      <Button type="submit" variant="gold" size="lg" loading={loading} className="w-full">
        {loading ? 'Forging Universe...' : '⚔️ Forge Universe'}
      </Button>
    </form>
  );
}
