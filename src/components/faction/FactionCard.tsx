'use client';

import { useState } from 'react';
import type { Faction } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge, CanonBadge } from '@/components/ui/Badge';
import { ShareAsArchetypeButton } from '@/components/shared-lore/ShareAsArchetypeButton';

interface FactionCardProps {
  faction: Faction;
  onDelete?: (id: string) => void;
  universeMeta?: { genre?: string; tone?: string; era?: string };
}

export function FactionCard({ faction, onDelete, universeMeta = {} }: FactionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">{faction.name}</h3>
            <Badge variant="default">{faction.type}</Badge>
          </div>
          <p className="text-[#c9a84c]/70 text-xs mt-0.5">Leader: {faction.leader}</p>
        </div>
        <div className="flex items-center gap-2">
          <CanonBadge status={faction.canon_status} />
          {onDelete && (
            <button
              onClick={() => onDelete(faction.id)}
              className="text-gray-600 hover:text-[#c41e3a] transition-colors opacity-0 group-hover:opacity-100 p-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-400 text-sm line-clamp-2 mb-2">{faction.ideology}</p>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>🤝 {faction.allies.length} allies</span>
        <span>⚔️ {faction.enemies.length} enemies</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[#c9a84c]/10 pt-3">
          {faction.territory && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Territory</span>
              <p className="text-gray-300 text-sm mt-0.5">{faction.territory}</p>
            </div>
          )}
          {faction.resources && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Resources</span>
              <p className="text-gray-300 text-sm mt-0.5">{faction.resources}</p>
            </div>
          )}
          {faction.objective && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Objective</span>
              <p className="text-gray-300 text-sm mt-0.5">{faction.objective}</p>
            </div>
          )}
          {faction.internal_conflict && (
            <div>
              <span className="text-[10px] text-[#c41e3a]/70 uppercase tracking-widest">Internal Conflict</span>
              <p className="text-gray-300 text-sm mt-0.5">{faction.internal_conflict}</p>
            </div>
          )}
          {faction.allies.length > 0 && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Allies</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {faction.allies.map((a, i) => (
                  <span key={i} className="text-xs bg-green-900/20 border border-green-500/20 rounded px-2 py-0.5 text-green-400">{a}</span>
                ))}
              </div>
            </div>
          )}
          {faction.enemies.length > 0 && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Enemies</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {faction.enemies.map((e, i) => (
                  <span key={i} className="text-xs bg-[#8b0000]/20 border border-[#c41e3a]/20 rounded px-2 py-0.5 text-[#c41e3a]">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors w-full text-left"
      >
        {expanded ? '▲ Collapse' : '▼ Expand Details'}
      </button>

      <div className="mt-2 flex justify-end">
        <ShareAsArchetypeButton
          target={{ kind: 'faction', entity: faction, universeMeta }}
        />
      </div>
    </Card>
  );
}
