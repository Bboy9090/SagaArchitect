'use client';

import type { TimelineEvent } from '@/lib/types';
import { CanonBadge } from '@/components/ui/Badge';

interface TimelineEventProps {
  event: TimelineEvent;
  index: number;
  onDelete?: (id: string) => void;
}

export function TimelineEventItem({ event, index, onDelete }: TimelineEventProps) {
  const canonColors: Record<string, string> = {
    canon: 'border-[#c9a84c] bg-[#c9a84c]',
    draft: 'border-[#3b82f6] bg-[#3b82f6]',
    alternate: 'border-purple-500 bg-purple-500',
    deprecated: 'border-gray-600 bg-gray-600',
    mystery: 'border-[#c41e3a] bg-[#c41e3a]',
  };

  const dotColor = canonColors[event.canon_status] ?? 'border-gray-600 bg-gray-600';

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 ${dotColor} mt-1.5 shrink-0`} />
        {index >= 0 && <div className="w-px flex-1 bg-[#c9a84c]/20 mt-1" />}
      </div>
      <div className="pb-6 flex-1">
        <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-3 group-hover:border-[#c9a84c]/40 transition-colors">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <h4 className="font-bold text-white text-sm">{event.title}</h4>
              <p className="text-[#c9a84c]/70 text-xs">{event.era_marker}</p>
            </div>
            <div className="flex items-center gap-2">
              <CanonBadge status={event.canon_status} />
              {onDelete && (
                <button
                  onClick={() => onDelete(event.id)}
                  className="text-gray-600 hover:text-[#c41e3a] transition-colors opacity-0 group-hover:opacity-100 p-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-1">{event.summary}</p>
          {event.consequences && (
            <p className="text-gray-500 text-xs mt-2 border-t border-[#c9a84c]/10 pt-2">
              <span className="text-[#c9a84c]/50">Consequences:</span> {event.consequences}
            </p>
          )}
          {(event.affected_characters.length > 0 || event.affected_factions.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {event.affected_characters.slice(0, 3).map((c, i) => (
                <span key={i} className="text-[10px] bg-[#1e3a8a]/30 border border-[#3b82f6]/20 rounded px-1.5 py-0.5 text-[#3b82f6]/80">👤 {c}</span>
              ))}
              {event.affected_factions.slice(0, 2).map((f, i) => (
                <span key={i} className="text-[10px] bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded px-1.5 py-0.5 text-[#c9a84c]/70">🏛️ {f}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
