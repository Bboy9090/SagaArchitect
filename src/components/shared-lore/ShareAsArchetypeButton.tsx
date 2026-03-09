'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  saveSharedLoreEntry,
  getSharedLoreEntryBySourceId,
} from '@/lib/storage';
import { isSharableAsArchetype } from '@/lib/archetype-engine';
import type { ArchetypePayload } from '@/lib/archetype-engine';
import type {
  Character,
  Faction,
  Location,
  StoryArc,
  LoreRule,
  Universe,
  SharedLoreEntry,
  SharedLoreSourceType,
} from '@/lib/types';

type SharableEntity =
  | { kind: 'character'; entity: Character; universeMeta: { genre?: string; tone?: string; era?: string } }
  | { kind: 'faction'; entity: Faction; universeMeta: { genre?: string; tone?: string; era?: string } }
  | { kind: 'location'; entity: Location; universeMeta: { genre?: string; tone?: string; era?: string } }
  | { kind: 'arc'; entity: StoryArc; universeMeta: { genre?: string; tone?: string; era?: string } }
  | { kind: 'lore_rule'; entity: LoreRule; universeMeta: { genre?: string; tone?: string; era?: string } }
  | { kind: 'universe'; entity: Universe };

interface ShareAsArchetypeButtonProps {
  target: SharableEntity;
  /** Called after a successful share so the parent can refresh state */
  onShared?: (entry: SharedLoreEntry) => void;
}

export function ShareAsArchetypeButton({ target, onShared }: ShareAsArchetypeButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [done, setDone] = useState(false);
  const [existingEntry, setExistingEntry] = useState<SharedLoreEntry | undefined>();
  const [error, setError] = useState<string | null>(null);

  const entityId = target.entity.id;

  const handleOpen = () => {
    const existing = getSharedLoreEntryBySourceId(entityId);
    setExistingEntry(existing);
    setDone(false);
    setError(null);
    setShowModal(true);
  };

  const handleShare = async () => {
    // Safety check — reject locked/private entities before any network call
    const entity = target.entity as { visibility?: string; is_locked?: boolean; canon_status?: string };
    if (!isSharableAsArchetype(entity)) {
      setError('This entity is locked or private and cannot be shared.');
      return;
    }

    // Map component kind to canonical SharedLoreSourceType.
    // Use canonical names (story_arc, lore_rule) — the extract endpoint accepts both
    // the canonical names and their legacy aliases (arc, rule_set).
    const sourceType: SharedLoreSourceType =
      target.kind === 'character' ? 'character'
      : target.kind === 'faction' ? 'faction'
      : target.kind === 'location' ? 'location'
      : target.kind === 'arc' ? 'story_arc'
      : target.kind === 'lore_rule' ? 'lore_rule'
      : 'world_seed';

    const universeMeta = target.kind === 'universe' ? {} : target.universeMeta;

    setSharing(true);
    setError(null);

    try {
      // ── Call POST /api/shared-lore-pool/extract ──────────────────────────
      // The server-side extraction engine strips all private names, universe IDs,
      // and locked canon links — returning only the abstracted pattern.
      const res = await fetch('/api/shared-lore-pool/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_app: 'sagaarch',
          source_type: sourceType,
          source_id: entityId,
          universe_meta: universeMeta,
          entity_data: target.entity,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string; detail?: string };
        throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`);
      }

      const { archetype } = await res.json() as { archetype: ArchetypePayload };

      // ── Save the abstracted entry to the local pool ──────────────────────
      const now = new Date().toISOString();
      const entry: SharedLoreEntry = {
        id: existingEntry?.id ?? crypto.randomUUID(),
        source_app: 'sagaarch',
        source_id: entityId,
        universe_id:
          target.kind === 'universe'
            ? target.entity.id
            : (target.entity as { universe_id: string }).universe_id,
        source_type: sourceType,
        visibility: 'shared_archetype',
        archetype_name: archetype.archetype_name,
        category: archetype.category,
        role_type: archetype.role_type,
        role_pattern: archetype.role_pattern,
        ideology_pattern: archetype.ideology_pattern,
        location_pattern: archetype.location_pattern,
        conflict_pattern: archetype.conflict_pattern,
        theme_tags: archetype.theme_tags,
        visual_tags: archetype.visual_tags,
        era_pattern: archetype.era_pattern,
        abstraction_summary: archetype.abstraction_summary,
        derivative_rules: archetype.derivative_rules,
        genre: archetype.genre,
        tone: archetype.tone,
        created_at: existingEntry?.created_at ?? now,
        updated_at: now,
      };

      saveSharedLoreEntry(entry);
      setDone(true);
      onShared?.(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const kindLabel =
    target.kind === 'universe' ? 'Universe'
    : target.kind === 'character' ? 'Character'
    : target.kind === 'faction' ? 'Faction'
    : target.kind === 'location' ? 'Location'
    : target.kind === 'arc' ? 'Arc'
    : 'Lore Rule';

  return (
    <>
      <button
        onClick={handleOpen}
        title="Share as Archetype"
        className="text-[10px] text-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#c9a84c]/10 hover:border-[#c9a84c]/40"
      >
        🌐 Share
      </button>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Share as Archetype"
        size="md"
      >
        {!done ? (
          <div className="space-y-4">
            <div className="bg-[#1a1a2e] border border-[#c9a84c]/20 rounded p-3">
              <p className="text-xs text-[#c9a84c] font-semibold mb-1">🔒 Canon Safety</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Sharing this {kindLabel.toLowerCase()} as an archetype will{' '}
                <strong className="text-white">strip all exact names, identifiers, and direct canon links</strong>.
                Only abstracted patterns (role, ideology, themes, visual descriptors) are saved to the Shared Lore Pool.
              </p>
            </div>

            {existingEntry && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                <p className="text-xs text-yellow-400">
                  ⚠️ This {kindLabel.toLowerCase()} already has a shared archetype (
                  <span className="font-mono">{existingEntry.archetype_name}</span>). Sharing again will update it.
                </p>
              </div>
            )}

            <div className="text-gray-400 text-xs space-y-1">
              <p>✅ What IS shared: role patterns, ideology patterns, theme tags, visual descriptors</p>
              <p>❌ What is NOT shared: names, universe ID, canon links, locked fields</p>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
                <p className="text-xs text-red-400">⚠️ {error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="gold" size="sm" loading={sharing} onClick={handleShare}>
                🌐 Share as Archetype
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} disabled={sharing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="text-center">
              <div className="text-4xl mb-3">🌐</div>
              <h3 className="text-white font-bold mb-1">Archetype Shared!</h3>
              <p className="text-gray-400 text-sm">
                Your {kindLabel.toLowerCase()} has been abstracted and added to the Shared Lore Pool.
              </p>
              <p className="text-[#c9a84c]/60 text-xs mt-2">
                No private canon was exposed. Only patterns were shared.
              </p>
            </div>
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
