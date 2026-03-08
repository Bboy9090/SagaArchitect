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
import type { LoreRule, CanonStatus, LoreConflictEntry, Character, Faction, TimelineEvent } from '@/lib/types';

interface LorePageProps {
  params: Promise<{ id: string }>;
}

function detectConflicts(
  rules: LoreRule[],
  characters: Character[],
  factions: Faction[],
  events: TimelineEvent[],
): LoreConflictEntry[] {
  const conflicts: LoreConflictEntry[] = [];

  // ── Duplicate rule titles ─────────────────────────────────────────────────
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

  // ── Mystery rules with no canon resolution ───────────────────────────────
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

  // ── Deprecated rules still in archive ────────────────────────────────────
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

  // ── Characters exist without timeline context ─────────────────────────────
  if (events.length === 0 && characters.length > 0) {
    conflicts.push({
      id: 'missing-timeline',
      universe_id: '',
      type: 'missing_link',
      title: 'Characters Exist Without Historical Context',
      description: `${characters.length} character(s) exist but no timeline events explain the world they inhabit.`,
      related_entities: ['Timeline', 'Characters'],
      severity: 'high',
    });
  }

  // ── Dead characters appearing in timeline events after their death ────────
  // We check if any dead/missing character's name appears in an event's
  // affected_characters list more than once, flagging it as a potential contradiction.
  if (characters.length > 0 && events.length > 1) {
    const deadChars = characters.filter(c => c.status === 'dead');
    deadChars.forEach(deadChar => {
      const deadNameLower = deadChar.name.toLowerCase();
      // Use strict equality on each entry to avoid partial-name false positives
      const mentioningEvents = events.filter(e =>
        e.affected_characters.some(name => name.toLowerCase() === deadNameLower)
      );
      if (mentioningEvents.length > 1) {
        conflicts.push({
          id: `dead-char-${deadChar.id}`,
          universe_id: '',
          type: 'contradiction',
          title: 'Dead Character Appears in Multiple Events',
          description: `"${deadChar.name}" has status "dead" but appears in ${mentioningEvents.length} timeline events. Verify their death hasn't been contradicted.`,
          related_entities: [deadChar.name, ...mentioningEvents.map(e => e.title)],
          severity: 'high',
        });
      }
    });
  }

  // ── Faction ally/enemy asymmetry conflicts ────────────────────────────────
  // If Faction A lists Faction B as an enemy, but Faction B lists Faction A as an ally,
  // that's a canon contradiction.
  if (factions.length > 1) {
    factions.forEach(factionA => {
      factionA.enemies.forEach(enemyName => {
        const factionB = factions.find(f =>
          f.name.toLowerCase() === enemyName.toLowerCase()
        );
        if (factionB && factionB.allies.some(a => a.toLowerCase() === factionA.name.toLowerCase())) {
          const conflictId = `ally-enemy-${factionA.id}-${factionB.id}`;
          // Avoid adding the same conflict twice (A→B and B→A)
          if (!conflicts.some(c => c.id === conflictId || c.id === `ally-enemy-${factionB.id}-${factionA.id}`)) {
            conflicts.push({
              id: conflictId,
              universe_id: '',
              type: 'contradiction',
              title: 'Faction Alliance Contradiction',
              description: `"${factionA.name}" lists "${factionB.name}" as an enemy, but "${factionB.name}" lists "${factionA.name}" as an ally. This is a canon conflict.`,
              related_entities: [factionA.name, factionB.name],
              severity: 'high',
            });
          }
        }
      });
    });
  }

  // ── Magic system rules potentially violated by character powers ───────────
  // Look for lore rules categorised as "Magic" or with magic-related titles,
  // then check if any character's powers description may contradict those rules.
  // We use word-boundary matching to avoid substring false positives.
  const magicRules = rules.filter(r =>
    r.category.toLowerCase().includes('magic') ||
    r.title.toLowerCase().includes('magic') ||
    r.title.toLowerCase().includes('forbidden')
  );
  if (magicRules.length > 0 && characters.length > 0) {
    magicRules.forEach(rule => {
      const forbiddenPatterns = ['cannot ', 'never ', 'impossible to ', 'forbidden to ', 'prohibited'];
      const ruleText = rule.description.toLowerCase();
      const hasForbiddenClause = forbiddenPatterns.some(p => ruleText.includes(p));
      if (hasForbiddenClause) {
        characters.forEach(char => {
          if (char.canon_status === 'canon' && char.powers) {
            const powersLower = char.powers.toLowerCase();
            // Tokenize powers into words to avoid substring false positives
            const powerWords = new Set(powersLower.match(/\b\w+\b/g) ?? []);
            const hasViolation = rule.applies_to.some(keyword => {
              if (keyword.length <= 3) return false;
              const kLower = keyword.toLowerCase();
              // Match on whole-word tokens only
              return powerWords.has(kLower);
            });
            if (hasViolation) {
              conflicts.push({
                id: `magic-violation-${rule.id}-${char.id}`,
                universe_id: '',
                type: 'contradiction',
                title: 'Potential Magic Rule Violation',
                description: `Character "${char.name}" has powers that may conflict with the lore rule "${rule.title}". Verify their abilities comply with: "${rule.description}"`,
                related_entities: [char.name, rule.title],
                severity: 'medium',
              });
            }
          }
        });
      }
    });
  }

  // ── Arcs without connected characters or factions ─────────────────────────
  if (factions.length > 0 && characters.length === 0) {
    conflicts.push({
      id: 'no-characters-for-factions',
      universe_id: '',
      type: 'missing_link',
      title: 'Factions Without Characters',
      description: `${factions.length} faction(s) exist but no characters have been created. Factions need leaders and members to drive story arcs.`,
      related_entities: factions.slice(0, 3).map(f => f.name),
      severity: 'medium',
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
