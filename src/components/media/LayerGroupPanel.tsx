'use client';

import { Button } from '@/components/ui/Button';
import type { PhoenixLayerGroup } from '@/lib/media-composition';

interface LayerGroupPanelProps {
  groups: PhoenixLayerGroup[];
  onCreate: () => void;
  onPatch: (id: string, patch: Partial<PhoenixLayerGroup>) => void;
  onDelete: (id: string) => void;
}

export function LayerGroupPanel({ groups, onCreate, onPatch, onDelete }: LayerGroupPanelProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-blue-300/60">Layer Groups</p>
        <Button size="sm" variant="ghost" onClick={onCreate}>New Group</Button>
      </div>
      <div className="mt-3 space-y-2">
        {groups.map(group => (
          <div key={group.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
            <input
              value={group.name}
              onChange={event => onPatch(group.id, { name: event.target.value.slice(0, 120) })}
              className="min-h-9 w-full rounded border border-white/10 bg-black/20 px-2 text-xs text-white"
              aria-label="Layer group name"
            />
            <div className="mt-2 grid grid-cols-3 gap-1">
              <Button size="sm" variant="ghost" onClick={() => onPatch(group.id, { visible: !group.visible })}>
                {group.visible ? 'Visible' : 'Hidden'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onPatch(group.id, { locked: !group.locked })}>
                {group.locked ? 'Locked' : 'Unlocked'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(group.id)}>Remove</Button>
            </div>
            <label className="mt-2 block text-[9px] uppercase tracking-wider text-slate-500">
              Group opacity {Math.round(group.opacity * 100)}%
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(group.opacity * 100)}
                onChange={event => onPatch(group.id, { opacity: Math.max(0, Math.min(1, Number(event.target.value) / 100)) })}
                className="mt-1 w-full"
              />
            </label>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-[11px] leading-5 text-slate-600">Create a folder to control multiple layers without flattening them.</p>
        )}
      </div>
    </section>
  );
}
