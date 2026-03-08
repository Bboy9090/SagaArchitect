'use client';

import { useState } from 'react';
import type { Location } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge, CanonBadge } from '@/components/ui/Badge';
import { ShareAsArchetypeButton } from '@/components/shared-lore/ShareAsArchetypeButton';

interface LocationCardProps {
  location: Location;
  onDelete?: (id: string) => void;
  universeMeta?: { genre?: string; tone?: string; era?: string };
}

export function LocationCard({ location, onDelete, universeMeta = {} }: LocationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">📍 {location.name}</h3>
            <Badge variant="default">{location.type}</Badge>
          </div>
          {location.region && (
            <p className="text-[#c9a84c]/70 text-xs mt-0.5">{location.region}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CanonBadge status={location.canon_status} />
          {onDelete && (
            <button
              onClick={() => onDelete(location.id)}
              className="text-gray-600 hover:text-[#c41e3a] transition-colors opacity-0 group-hover:opacity-100 p-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-400 text-sm line-clamp-2 mb-2">{location.description}</p>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[#c9a84c]/10 pt-3">
          {location.strategic_value && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Strategic Value</span>
              <p className="text-gray-300 text-sm mt-0.5">{location.strategic_value}</p>
            </div>
          )}
          {location.mythic_importance && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Mythic Importance</span>
              <p className="text-gray-300 text-sm mt-0.5">{location.mythic_importance}</p>
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
          target={{ kind: 'location', entity: location, universeMeta }}
        />
      </div>
    </Card>
  );
}
