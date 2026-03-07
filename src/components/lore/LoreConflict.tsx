import type { LoreConflictEntry } from '@/lib/types';

interface LoreConflictProps {
  conflict: LoreConflictEntry;
}

const severityClasses = {
  low: 'border-yellow-500/30 bg-yellow-900/10',
  medium: 'border-orange-500/30 bg-orange-900/10',
  high: 'border-[#c41e3a]/40 bg-[#8b0000]/10',
};

const typeIcons = {
  contradiction: '⚡',
  duplicate: '🔄',
  missing_link: '🔗',
  mystery: '🔮',
};

export function LoreConflictItem({ conflict }: LoreConflictProps) {
  return (
    <div className={`border rounded-lg p-3 ${severityClasses[conflict.severity]}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg mt-0.5">{typeIcons[conflict.type]}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-white text-sm">{conflict.title}</h4>
            <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
              conflict.severity === 'high' ? 'bg-[#c41e3a]/20 text-[#c41e3a]' :
              conflict.severity === 'medium' ? 'bg-orange-900/30 text-orange-400' :
              'bg-yellow-900/30 text-yellow-400'
            }`}>
              {conflict.severity} severity
            </span>
          </div>
          <p className="text-gray-400 text-sm">{conflict.description}</p>
          {conflict.related_entities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {conflict.related_entities.map((e, i) => (
                <span key={i} className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-gray-400">{e}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
