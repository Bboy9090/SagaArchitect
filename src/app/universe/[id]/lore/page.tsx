'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { LoreMemoryPanel } from '@/components/lore/LoreMemoryPanel';
import { LoreConflictItem } from '@/components/lore/LoreConflict';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getLoreRules, saveLoreRule, deleteLoreRule, getUniverseById, getCharacters, getFactions, getTimeline } from '@/lib/storage';
import type { LoreRule, CanonStatus, LoreConflictEntry } from '@/lib/types';

interface LorePageProps {
  params: Promise<{ id: string }>;
}

function detectConflicts(rules: LoreRule[], characters: unknown[], factions: unknown[], events: unknown[]): LoreConflictEntry[] {
  const conflicts: LoreConflictEntry[] = [];

  // Check for duplicate rule titles
  const titleCounts = new Map<string, number>();
  rules.forEach(r => {
    const key = r.title.toLowerCase().trim();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  });
  titleCounts.forEach((count, title) => {
    if (count > 1) {
      conflicts.push({
        id: `dup-${title}`,
        universe_id: '',
        type: 'duplicate',
        title: 'Duplicate Lore Rule',
        description: `The rule "${title}" appears ${count} times in the lore archive.`,
        related_entities: rules.filter(r => r.title.toLowerCase().trim() === title).map(r => r.title),
        severity: 'medium',
      });
    }
  });

  // Check for mystery items with no explanation
  const mysteryRules = rules.filter(r => r.canon_status === 'mystery');
  mysteryRules.forEach(r => {
    conflicts.push({
      id: `mystery-${r.id}`,
      universe_id: '',
      type: 'mystery',
      title: 'Unresolved Mystery',
      description: `Lore rule "${r.title}" is marked as mystery with no canon resolution.`,
      related_entities: [r.title],
      severity: 'low',
    });
  });

  // Check for deprecated items still referenced
  const deprecatedRules = rules.filter(r => r.canon_status === 'deprecated');
  if (deprecatedRules.length > 0) {
    conflicts.push({
      id: 'deprecated-rules',
      universe_id: '',
      type: 'contradiction',
      title: 'Deprecated Rules Still in Archive',
      description: `${deprecatedRules.length} deprecated rule(s) remain in the archive and may conflict with current canon.`,
      related_entities: deprecatedRules.map(r => r.title),
      severity: 'medium',
    });
  }

  // Check for empty timeline
  if ((events as unknown[]).length === 0 && (characters as unknown[]).length > 0) {
    conflicts.push({
      id: 'missing-timeline',
      universe_id: '',
      type: 'missing_link',
      title: 'Characters Exist Without Historical Context',
      description: `${(characters as unknown[]).length} character(s) exist but no timeline events explain the world they inhabit.`,
      related_entities: ['Timeline', 'Characters'],
      severity: 'high',
    });
  }

  // Check for characters with no faction
  if ((factions as unknown[]).length > 0) {
    conflicts.push({
      id: 'no-faction-check',
      universe_id: '',
      type: 'missing_link',
      title: 'Canon Consistency Note',
      description: 'Verify all characters have faction affiliations if the faction system is active.',
      related_entities: ['Characters', 'Factions'],
      severity: 'low',
    });
  }

  return conflicts;
}

export default function LorePage({ params }: LorePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [loreState, setLoreState] = useState<{
    rules: LoreRule[];
    conflicts: LoreConflictEntry[];
    loading: boolean;
  }>({ rules: [], conflicts: [], loading: true });
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'conflicts'>('rules');

  const [form, setForm] = useState({
    title: '', category: 'World Rules', description: '', applies_to: '', canon_status: 'canon' as CanonStatus,
  });

  const { rules, conflicts, loading } = loreState;

  useEffect(() => {
    void (async () => {
      const u = getUniverseById(id);
      if (!u) { router.push('/dashboard'); return; }
      const loreRules = getLoreRules(id);
      const chars = getCharacters(id);
      const factions = getFactions(id);
      const events = getTimeline(id);
      const detectedConflicts = detectConflicts(loreRules, chars, factions, events);
      setLoreState({ rules: loreRules, conflicts: detectedConflicts, loading: false });
    })();
  }, [id, router]);

  const handleDelete = (ruleId: string) => {
    deleteLoreRule(id, ruleId);
    setLoreState(prev => ({ ...prev, rules: prev.rules.filter(r => r.id !== ruleId) }));
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const rule: LoreRule = {
      id: crypto.randomUUID(),
      universe_id: id,
      title: form.title,
      category: form.category,
      description: form.description,
      applies_to: form.applies_to.split(',').map(s => s.trim()).filter(Boolean),
      canon_status: form.canon_status,
    };
    saveLoreRule(rule);
    setLoreState(prev => ({ ...prev, rules: [...prev.rules, rule] }));
    setShowForm(false);
    setForm({ title: '', category: 'World Rules', description: '', applies_to: '', canon_status: 'canon' });
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Scanning the archive..." />
      </div>
    </Navigation>
  );

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

  return (
    <Navigation>
      <Header
        title="Lore Memory"
        subtitle="Canon rules, consistency checks, and contradiction detection"
        actions={
          <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
            + Add Lore Rule
          </Button>
        }
      />

      <div className="px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-[#c9a84c]">{rules.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Lore Rules</div>
          </div>
          <div className="bg-[#0f0f1a] border border-[#c41e3a]/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-[#c41e3a]">{conflicts.filter(c => c.severity === 'high').length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">High Severity</div>
          </div>
          <div className="bg-[#0f0f1a] border border-orange-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-400">{conflicts.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Total Issues</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'rules', label: `📜 Lore Rules (${rules.length})` },
            { key: 'conflicts', label: `⚠️ Consistency Issues (${conflicts.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'rules' | 'conflicts')}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30'
                  : 'text-gray-400 border border-transparent hover:text-white hover:border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'rules' && (
          rules.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📜</div>
              <h3 className="text-lg font-bold text-white mb-2">No Lore Rules Yet</h3>
              <p className="text-gray-500 mb-4 text-sm">Define the laws of your universe. What is always true? What can never happen?</p>
              <Button variant="gold" onClick={() => setShowForm(true)}>+ Add First Rule</Button>
            </div>
          ) : (
            <LoreMemoryPanel rules={rules} onDelete={handleDelete} />
          )
        )}

        {activeTab === 'conflicts' && (
          conflicts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-lg font-bold text-white mb-2">No Issues Detected</h3>
              <p className="text-gray-500 text-sm">Your canon appears internally consistent.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map(conflict => (
                <LoreConflictItem key={conflict.id} conflict={conflict} />
              ))}
            </div>
          )
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Lore Rule" size="lg">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Rule Title *</label>
            <input className={inputClass} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Name of this lore rule" />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <input className={inputClass} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g., Magic System, World Rules, Artifacts" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={4} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed explanation of this rule..." />
          </div>
          <div>
            <label className={labelClass}>Applies To (comma-separated)</label>
            <input className={inputClass} value={form.applies_to} onChange={e => setForm(p => ({ ...p, applies_to: e.target.value }))} placeholder="Character 1, Faction 2, Location 3" />
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
            <Button variant="gold" onClick={handleSave} disabled={!form.title.trim()}>Save Rule</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </Navigation>
  );
}
