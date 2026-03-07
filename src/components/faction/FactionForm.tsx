'use client';

import { useState } from 'react';
import type { Faction, CanonStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface FactionFormProps {
  universeId: string;
  onSave: (faction: Omit<Faction, 'id'>) => void;
  onCancel: () => void;
  initial?: Partial<Faction>;
}

export function FactionForm({ universeId, onSave, onCancel, initial }: FactionFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? '',
    ideology: initial?.ideology ?? '',
    leader: initial?.leader ?? '',
    resources: initial?.resources ?? '',
    allies: initial?.allies?.join(', ') ?? '',
    enemies: initial?.enemies?.join(', ') ?? '',
    territory: initial?.territory ?? '',
    internal_conflict: initial?.internal_conflict ?? '',
    objective: initial?.objective ?? '',
    canon_status: (initial?.canon_status ?? 'draft') as CanonStatus,
  });

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      universe_id: universeId,
      name: form.name,
      type: form.type,
      ideology: form.ideology,
      leader: form.leader,
      resources: form.resources,
      allies: form.allies.split(',').map(s => s.trim()).filter(Boolean),
      enemies: form.enemies.split(',').map(s => s.trim()).filter(Boolean),
      territory: form.territory,
      internal_conflict: form.internal_conflict,
      objective: form.objective,
      canon_status: form.canon_status,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Faction Name *</label>
          <input className={inputClass} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Faction name" />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <input className={inputClass} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} placeholder="e.g., Military Order, Guild, Empire" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Leader</label>
        <input className={inputClass} value={form.leader} onChange={e => setForm(p => ({ ...p, leader: e.target.value }))} placeholder="Leader name and title" />
      </div>
      <div>
        <label className={labelClass}>Ideology</label>
        <textarea className={inputClass} rows={2} value={form.ideology} onChange={e => setForm(p => ({ ...p, ideology: e.target.value }))} placeholder="Core beliefs and philosophy..." />
      </div>
      <div>
        <label className={labelClass}>Territory</label>
        <input className={inputClass} value={form.territory} onChange={e => setForm(p => ({ ...p, territory: e.target.value }))} placeholder="Geographic territory or domain" />
      </div>
      <div>
        <label className={labelClass}>Resources</label>
        <textarea className={inputClass} rows={2} value={form.resources} onChange={e => setForm(p => ({ ...p, resources: e.target.value }))} placeholder="Resources and capabilities..." />
      </div>
      <div>
        <label className={labelClass}>Objective</label>
        <textarea className={inputClass} rows={2} value={form.objective} onChange={e => setForm(p => ({ ...p, objective: e.target.value }))} placeholder="What does this faction want?" />
      </div>
      <div>
        <label className={labelClass}>Internal Conflict</label>
        <textarea className={inputClass} rows={2} value={form.internal_conflict} onChange={e => setForm(p => ({ ...p, internal_conflict: e.target.value }))} placeholder="Internal tensions or fractures..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Allies (comma-separated)</label>
          <input className={inputClass} value={form.allies} onChange={e => setForm(p => ({ ...p, allies: e.target.value }))} placeholder="Ally 1, Ally 2" />
        </div>
        <div>
          <label className={labelClass}>Enemies (comma-separated)</label>
          <input className={inputClass} value={form.enemies} onChange={e => setForm(p => ({ ...p, enemies: e.target.value }))} placeholder="Enemy 1, Enemy 2" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Canon Status</label>
        <select className={inputClass} value={form.canon_status} onChange={e => setForm(p => ({ ...p, canon_status: e.target.value as CanonStatus }))}>
          {(['canon', 'draft', 'alternate', 'deprecated', 'mystery'] as CanonStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="gold" onClick={handleSave} disabled={!form.name.trim()}>Save Faction</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
