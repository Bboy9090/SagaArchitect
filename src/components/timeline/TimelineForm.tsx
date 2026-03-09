'use client';

import { useState } from 'react';
import type { TimelineEvent, CanonStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface TimelineFormProps {
  universeId: string;
  onSave: (event: Omit<TimelineEvent, 'id'>) => void;
  onCancel: () => void;
}

export function TimelineForm({ universeId, onSave, onCancel }: TimelineFormProps) {
  const [form, setForm] = useState({
    title: '',
    era_marker: '',
    summary: '',
    consequences: '',
    affected_characters: '',
    affected_factions: '',
    affected_locations: '',
    canon_status: 'draft' as CanonStatus,
  });

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      universe_id: universeId,
      title: form.title,
      era_marker: form.era_marker,
      summary: form.summary,
      consequences: form.consequences,
      affected_characters: form.affected_characters.split(',').map(s => s.trim()).filter(Boolean),
      affected_factions: form.affected_factions.split(',').map(s => s.trim()).filter(Boolean),
      affected_locations: form.affected_locations.split(',').map(s => s.trim()).filter(Boolean),
      canon_status: form.canon_status,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Event Title *</label>
        <input className={inputClass} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Name of this historical event" />
      </div>
      <div>
        <label className={labelClass}>Era / Time Marker</label>
        <input className={inputClass} value={form.era_marker} onChange={e => setForm(p => ({ ...p, era_marker: e.target.value }))} placeholder='e.g., "Year Zero / The Fracture"' />
      </div>
      <div>
        <label className={labelClass}>Summary</label>
        <textarea className={inputClass} rows={3} value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="What happened?" />
      </div>
      <div>
        <label className={labelClass}>Consequences</label>
        <textarea className={inputClass} rows={2} value={form.consequences} onChange={e => setForm(p => ({ ...p, consequences: e.target.value }))} placeholder="Long-term effects on the world..." />
      </div>
      <div>
        <label className={labelClass}>Affected Characters (comma-separated)</label>
        <input className={inputClass} value={form.affected_characters} onChange={e => setForm(p => ({ ...p, affected_characters: e.target.value }))} placeholder="Character 1, Character 2" />
      </div>
      <div>
        <label className={labelClass}>Affected Factions (comma-separated)</label>
        <input className={inputClass} value={form.affected_factions} onChange={e => setForm(p => ({ ...p, affected_factions: e.target.value }))} placeholder="Faction 1, Faction 2" />
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
        <Button variant="gold" onClick={handleSave} disabled={!form.title.trim()}>Save Event</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
