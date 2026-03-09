'use client';

import type { SharedLoreEntry } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const SOURCE_ICONS: Record<string, string> = {
  character: '👤',
  faction: '🏛️',
  location: '📍',
  arc: '⚔️',
  world_seed: '🌍',
  rule_set: '📜',
};

const VISIBILITY_COLORS: Record<string, 'canon' | 'draft' | 'success' | 'info' | 'default'> = {
  shared_archetype: 'draft',
  public_template: 'success',
  demo_only: 'info',
  private: 'default',
};

interface SharedLoreCardProps {
  entry: Omit<SharedLoreEntry, 'owner_user_id' | 'universe_id' | 'source_id'> | SharedLoreEntry;
  onDelete?: (id: string) => void;
  showDeleteButton?: boolean;
}

export function SharedLoreCard({ entry, onDelete, showDeleteButton = false }: SharedLoreCardProps) {
  const icon = SOURCE_ICONS[entry.source_type] ?? '🔮';

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{icon}</span>
            <h3 className="font-bold text-white text-sm">{entry.archetype_name}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={VISIBILITY_COLORS[entry.visibility] ?? 'default'}>
              {entry.visibility === 'shared_archetype' ? '🌐 Archetype'
                : entry.visibility === 'public_template' ? '📋 Template'
                : entry.visibility === 'demo_only' ? '🌑 Demo'
                : '🔒 Private'}
            </Badge>
            <Badge variant="default">{entry.category}</Badge>
            {entry.genre && <Badge variant="info">{entry.genre}</Badge>}
          </div>
        </div>
        {showDeleteButton && onDelete && (
          <button
            onClick={() => onDelete(entry.id)}
            className="text-gray-600 hover:text-[#c41e3a] transition-colors p-1 ml-2"
            title="Remove from pool"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <p className="text-gray-400 text-xs leading-relaxed mb-3">{entry.abstraction_summary}</p>

      {(entry.role_pattern || entry.ideology_pattern || entry.location_pattern || entry.conflict_pattern) && (
        <div className="space-y-1.5 mb-3">
          {entry.role_pattern && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-widest">Role Pattern</span>
              <p className="text-gray-300 text-xs mt-0.5">{entry.role_pattern}</p>
            </div>
          )}
          {entry.ideology_pattern && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-widest">Ideology Pattern</span>
              <p className="text-gray-300 text-xs mt-0.5">{entry.ideology_pattern}</p>
            </div>
          )}
          {entry.location_pattern && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-widest">Location Pattern</span>
              <p className="text-gray-300 text-xs mt-0.5">{entry.location_pattern}</p>
            </div>
          )}
          {entry.conflict_pattern && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-widest">Conflict Pattern</span>
              <p className="text-gray-300 text-xs mt-0.5">{entry.conflict_pattern}</p>
            </div>
          )}
        </div>
      )}

      {entry.theme_tags.length > 0 && (
        <div className="mb-2">
          <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-widest block mb-1">Themes</span>
          <div className="flex flex-wrap gap-1">
            {entry.theme_tags.map((tag, i) => (
              <span
                key={i}
                className="text-[10px] bg-purple-900/20 border border-purple-500/20 rounded px-2 py-0.5 text-purple-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {entry.visual_tags.length > 0 && (
        <div>
          <span className="text-[10px] text-[#c9a84c]/60 uppercase tracking-widest block mb-1">Visual Tags</span>
          <div className="flex flex-wrap gap-1">
            {entry.visual_tags.map((tag, i) => (
              <span
                key={i}
                className="text-[10px] bg-[#1e3a8a]/20 border border-[#3b82f6]/20 rounded px-2 py-0.5 text-[#3b82f6]/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {entry.era_pattern && (
        <p className="text-[10px] text-gray-600 mt-2">Era: {entry.era_pattern}</p>
      )}
    </Card>
  );
}
