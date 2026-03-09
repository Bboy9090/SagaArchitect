'use client';

import { useState } from 'react';
import type { StoryArc, ArcType } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface ArcFormProps {
  universeId: string;
  onSave: (arc: Omit<StoryArc, 'id'>) => void;
  onCancel: () => void;
  selectedType?: ArcType;
}

const ARC_TYPES: { type: ArcType; label: string; icon: string }[] = [
  { type: 'trilogy', label: 'Trilogy Arc', icon: '📚' },
  { type: 'season', label: 'Season Arc', icon: '🎬' },
  { type: 'hero', label: 'Single Hero Arc', icon: '⚡' },
  { type: 'villain', label: 'Villain Arc', icon: '👁️' },
  { type: 'redemption', label: 'Redemption Arc', icon: '✨' },
  { type: 'war', label: 'War Arc', icon: '⚔️' },
  { type: 'prophecy', label: 'Prophecy Arc', icon: '🔮' },
  { type: 'empire_fall', label: 'Empire Fall Arc', icon: '🏚️' },
];

export function ArcForm({ universeId, onSave, onCancel, selectedType }: ArcFormProps) {
  const [form, setForm] = useState({
    title: '',
    type: selectedType ?? 'hero' as ArcType,
    summary: '',
    start_point: '',
    end_point: '',
    involved_characters: '',
    involved_factions: '',
    themes: '',
  });

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      universe_id: universeId,
      title: form.title,
      type: form.type,
      summary: form.summary,
      start_point: form.start_point,
      end_point: form.end_point,
      involved_characters: form.involved_characters.split(',').map(s => s.trim()).filter(Boolean),
      involved_factions: form.involved_factions.split(',').map(s => s.trim()).filter(Boolean),
      themes: form.themes.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Arc Type</label>
        <div className="grid grid-cols-4 gap-2">
          {ARC_TYPES.map(at => (
            <button
              key={at.type}
              onClick={() => setForm(p => ({ ...p, type: at.type }))}
              className={`flex flex-col items-center gap-1 p-2 rounded border text-xs transition-all ${
                form.type === at.type
                  ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]'
                  : 'border-[#c9a84c]/20 text-gray-400 hover:border-[#c9a84c]/50'
              }`}
            >
              <span className="text-lg">{at.icon}</span>
              <span className="text-center leading-tight">{at.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass}>Arc Title *</label>
        <input className={inputClass} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Arc title..." />
      </div>
      <div>
        <label className={labelClass}>Summary</label>
        <textarea className={inputClass} rows={3} value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="What is this arc about?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Opening / Start Point</label>
          <textarea className={inputClass} rows={2} value={form.start_point} onChange={e => setForm(p => ({ ...p, start_point: e.target.value }))} placeholder="Where/how the arc begins..." />
        </div>
        <div>
          <label className={labelClass}>Resolution / End Point</label>
          <textarea className={inputClass} rows={2} value={form.end_point} onChange={e => setForm(p => ({ ...p, end_point: e.target.value }))} placeholder="How the arc resolves..." />
        </div>
      </div>
      <div>
        <label className={labelClass}>Involved Characters (comma-separated)</label>
        <input className={inputClass} value={form.involved_characters} onChange={e => setForm(p => ({ ...p, involved_characters: e.target.value }))} placeholder="Character 1, Character 2" />
      </div>
      <div>
        <label className={labelClass}>Themes (comma-separated)</label>
        <input className={inputClass} value={form.themes} onChange={e => setForm(p => ({ ...p, themes: e.target.value }))} placeholder="e.g., Identity, Sacrifice, Legacy" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="gold" onClick={handleSave} disabled={!form.title.trim()}>Save Arc</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
