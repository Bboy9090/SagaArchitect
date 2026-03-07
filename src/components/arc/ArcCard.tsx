'use client';

import type { StoryArc, ArcType } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ArcCardProps {
  arc: StoryArc;
  onDelete?: (id: string) => void;
}

const arcTypeLabels: Record<ArcType, string> = {
  trilogy: '📚 Trilogy Arc',
  season: '🎬 Season Arc',
  hero: '⚡ Hero Arc',
  villain: '👁️ Villain Arc',
  redemption: '✨ Redemption Arc',
  war: '⚔️ War Arc',
  prophecy: '🔮 Prophecy Arc',
  empire_fall: '🏚️ Empire Fall Arc',
};

export function ArcCard({ arc, onDelete }: ArcCardProps) {
  return (
    <Card className="group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-white">{arc.title}</h3>
          <Badge variant="info" className="mt-1">{arcTypeLabels[arc.type]}</Badge>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(arc.id)}
            className="text-gray-600 hover:text-[#c41e3a] transition-colors opacity-0 group-hover:opacity-100 p-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <p className="text-gray-400 text-sm mb-3">{arc.summary}</p>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest block">Opening</span>
          <p className="text-gray-300 text-xs">{arc.start_point}</p>
        </div>
        <div>
          <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-widest block">Resolution</span>
          <p className="text-gray-300 text-xs">{arc.end_point}</p>
        </div>
      </div>

      {arc.themes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {arc.themes.map((t, i) => (
            <span key={i} className="text-[10px] bg-purple-900/20 border border-purple-500/20 rounded px-2 py-0.5 text-purple-300">{t}</span>
          ))}
        </div>
      )}

      {arc.involved_characters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {arc.involved_characters.map((c, i) => (
            <span key={i} className="text-[10px] bg-[#1e3a8a]/20 border border-[#3b82f6]/20 rounded px-1.5 py-0.5 text-[#3b82f6]/70">👤 {c}</span>
          ))}
        </div>
      )}
    </Card>
  );
}
