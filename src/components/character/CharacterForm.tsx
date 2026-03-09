'use client';

import { useState } from 'react';
import type { Character, CanonStatus, CharacterStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface CharacterFormProps {
  universeId: string;
  onSave: (character: Omit<Character, 'id'>) => void;
  onCancel: () => void;
  initial?: Partial<Character>;
}

export function CharacterForm({ universeId, onSave, onCancel, initial }: CharacterFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    title: initial?.title ?? '',
    role: initial?.role ?? '',
    motivations: initial?.motivations ?? '',
    fears: initial?.fears ?? '',
    powers: initial?.powers ?? '',
    weaknesses: initial?.weaknesses ?? '',
    arc_potential: initial?.arc_potential ?? '',
    status: (initial?.status ?? 'alive') as CharacterStatus,
    canon_status: (initial?.canon_status ?? 'draft') as CanonStatus,
    faction_id: initial?.faction_id ?? '',
  });

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      universe_id: universeId,
      faction_id: form.faction_id || undefined,
      name: form.name,
      title: form.title,
      role: form.role,
      motivations: form.motivations,
      fears: form.fears,
      powers: form.powers,
      weaknesses: form.weaknesses,
      arc_potential: form.arc_potential,
      status: form.status,
      canon_status: form.canon_status,
      relationships: initial?.relationships ?? [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name *</label>
          <input className={inputClass} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Character name" />
        </div>
        <div>
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., The Hollow Blade" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <input className={inputClass} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="e.g., Protagonist / Former Warden" />
      </div>
      <div>
        <label className={labelClass}>Motivations</label>
        <textarea className={inputClass} rows={2} value={form.motivations} onChange={e => setForm(p => ({ ...p, motivations: e.target.value }))} placeholder="What drives this character?" />
      </div>
      <div>
        <label className={labelClass}>Fears</label>
        <textarea className={inputClass} rows={2} value={form.fears} onChange={e => setForm(p => ({ ...p, fears: e.target.value }))} placeholder="What does this character fear?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Powers / Abilities</label>
          <textarea className={inputClass} rows={2} value={form.powers} onChange={e => setForm(p => ({ ...p, powers: e.target.value }))} placeholder="Powers and abilities..." />
        </div>
        <div>
          <label className={labelClass}>Weaknesses</label>
          <textarea className={inputClass} rows={2} value={form.weaknesses} onChange={e => setForm(p => ({ ...p, weaknesses: e.target.value }))} placeholder="Weaknesses and flaws..." />
        </div>
      </div>
      <div>
        <label className={labelClass}>Arc Potential</label>
        <textarea className={inputClass} rows={2} value={form.arc_potential} onChange={e => setForm(p => ({ ...p, arc_potential: e.target.value }))} placeholder="What is this character's story arc?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as CharacterStatus }))}>
            {(['alive', 'dead', 'missing', 'legendary', 'unknown'] as CharacterStatus[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Canon Status</label>
          <select className={inputClass} value={form.canon_status} onChange={e => setForm(p => ({ ...p, canon_status: e.target.value as CanonStatus }))}>
            {(['canon', 'draft', 'alternate', 'deprecated', 'mystery'] as CanonStatus[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="gold" onClick={handleSave} disabled={!form.name.trim()}>Save Character</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
