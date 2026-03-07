'use client';

import Link from 'next/link';
import type { Universe } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface UniverseCardProps {
  universe: Universe;
  characterCount?: number;
  factionCount?: number;
  eventCount?: number;
  onDelete?: (id: string) => void;
}

export function UniverseCard({ universe, characterCount = 0, factionCount = 0, eventCount = 0, onDelete }: UniverseCardProps) {
  return (
    <Card className="group relative" glow>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <Link href={`/universe/${universe.id}`}>
            <h3 className="text-lg font-bold text-white group-hover:text-[#c9a84c] transition-colors truncate cursor-pointer">
              {universe.name}
            </h3>
          </Link>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="default">{universe.genre}</Badge>
            <Badge variant="default">{universe.tone}</Badge>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(universe.id)}
            className="text-gray-600 hover:text-[#c41e3a] transition-colors ml-2 opacity-0 group-hover:opacity-100 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <p className="text-gray-400 text-sm line-clamp-2 mb-3">{universe.concept}</p>

      <div className="text-xs text-gray-500 mb-3">
        <span className="text-[#c9a84c]/70">Era:</span> {universe.era}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#c9a84c]/10">
        <div className="text-center">
          <div className="text-lg font-bold text-[#c9a84c]">{characterCount}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">Characters</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-[#c9a84c]">{factionCount}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">Factions</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-[#c9a84c]">{eventCount}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">Events</div>
        </div>
      </div>

      <Link href={`/universe/${universe.id}`} className="block mt-3">
        <div className="text-center text-xs text-[#c9a84c]/60 hover:text-[#c9a84c] transition-colors border border-[#c9a84c]/20 hover:border-[#c9a84c]/50 rounded py-1.5">
          Open Canon Core →
        </div>
      </Link>
    </Card>
  );
}
