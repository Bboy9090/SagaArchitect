'use client';

import { useState } from 'react';
import type { Character } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge, CanonBadge } from '@/components/ui/Badge';

interface CharacterCardProps {
  character: Character;
  onDelete?: (id: string) => void;
}

export function CharacterCard({ character, onDelete }: CharacterCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    alive: 'success',
    dead: 'danger',
    missing: 'warning',
    legendary: 'canon',
    unknown: 'default',
  };

  return (
    <Card className="group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">{character.name}</h3>
            <Badge variant={statusColors[character.status] as 'success' | 'danger' | 'warning' | 'canon' | 'default'}>
              {character.status}
            </Badge>
          </div>
          {character.title && (
            <p className="text-[#c9a84c] text-xs mt-0.5 italic">{character.title}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CanonBadge status={character.canon_status} />
          {onDelete && (
            <button
              onClick={() => onDelete(character.id)}
              className="text-gray-600 hover:text-[#c41e3a] transition-colors opacity-0 group-hover:opacity-100 p-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-2">{character.role}</p>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[#c9a84c]/10 pt-3">
          {character.motivations && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Motivations</span>
              <p className="text-gray-300 text-sm mt-0.5">{character.motivations}</p>
            </div>
          )}
          {character.fears && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Fears</span>
              <p className="text-gray-300 text-sm mt-0.5">{character.fears}</p>
            </div>
          )}
          {character.powers && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Powers / Abilities</span>
              <p className="text-gray-300 text-sm mt-0.5">{character.powers}</p>
            </div>
          )}
          {character.weaknesses && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Weaknesses</span>
              <p className="text-gray-300 text-sm mt-0.5">{character.weaknesses}</p>
            </div>
          )}
          {character.arc_potential && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Arc Potential</span>
              <p className="text-gray-300 text-sm mt-0.5">{character.arc_potential}</p>
            </div>
          )}
          {character.relationships && character.relationships.length > 0 && (
            <div>
              <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest">Relationships</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {character.relationships.map((rel, i) => (
                  <span key={i} className="text-xs bg-[#1a1a2e] border border-[#c9a84c]/20 rounded px-2 py-0.5 text-gray-300">
                    {rel.character_name} <span className="text-[#c9a84c]/60">({rel.type})</span>
                  </span>
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
        {expanded ? '▲ Collapse' : '▼ Expand Profile'}
      </button>
    </Card>
  );
}
