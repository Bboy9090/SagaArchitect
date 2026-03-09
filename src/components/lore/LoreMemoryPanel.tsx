'use client';

import { useState } from 'react';
import type { LoreRule } from '@/lib/types';
import { CanonBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface LoreMemoryPanelProps {
  rules: LoreRule[];
  onDelete?: (id: string) => void;
}

export function LoreMemoryPanel({ rules, onDelete }: LoreMemoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = Array.from(new Set(rules.map(r => r.category)));

  return (
    <div className="space-y-6">
      {categories.map(category => (
        <div key={category}>
          <h3 className="text-xs text-[#c9a84c]/70 uppercase tracking-widest mb-3 border-b border-[#c9a84c]/10 pb-1">
            {category}
          </h3>
          <div className="space-y-2">
            {rules.filter(r => r.category === category).map(rule => (
              <Card key={rule.id} className="group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white text-sm">{rule.title}</h4>
                      <CanonBadge status={rule.canon_status} />
                    </div>
                    {expandedId === rule.id && (
                      <p className="text-gray-400 text-sm mt-1">{rule.description}</p>
                    )}
                    {expandedId === rule.id && rule.applies_to.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[10px] text-gray-500">Applies to:</span>
                        {rule.applies_to.map((a, i) => (
                          <span key={i} className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-gray-400">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(rule.id)}
                        className="text-gray-600 hover:text-[#c41e3a] transition-colors opacity-0 group-hover:opacity-100 p-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                  className="text-[10px] text-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors mt-1"
                >
                  {expandedId === rule.id ? '▲ Collapse' : '▼ Read Rule'}
                </button>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
