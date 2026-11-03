'use client';

import { Button } from '@/components/ui/Button';
import type { PhoenixMediaLayer } from '@/lib/media-composition';

interface LayerShadowPanelProps {
  layer: PhoenixMediaLayer;
  onChange: (patch: Partial<PhoenixMediaLayer>) => void;
}

export function LayerShadowPanel({ layer, onChange }: LayerShadowPanelProps) {
  const shadow = layer.shadow;

  return (
    <section className="rounded-lg border border-indigo-400/20 bg-indigo-400/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Drop Shadow</div>
          <div className="mt-1 text-[11px] leading-5 text-slate-600">Non-destructive layer effect.</div>
        </div>
        <Button
          size="sm"
          variant={shadow ? 'gold' : 'ghost'}
          onClick={() => onChange({
            shadow: shadow ? undefined : {
              color: '#000000',
              opacity: 0.55,
              blur: 18,
              offsetX: 12,
              offsetY: 12,
            },
          } as Partial<PhoenixMediaLayer>)}
        >
          {shadow ? 'On' : 'Enable'}
        </Button>
      </div>

      {shadow && (
        <div className="mt-3 space-y-3">
          <label className="block text-[10px] uppercase text-slate-500">Color
            <input
              type="color"
              value={shadow.color}
              onChange={event => onChange({ shadow: { ...shadow, color: event.target.value } } as Partial<PhoenixMediaLayer>)}
              className="mt-1 h-9 w-full"
            />
          </label>

          <label className="block text-[10px] uppercase text-slate-500">
            <span className="flex items-center justify-between"><span>Opacity</span><span>{Math.round(shadow.opacity * 100)}%</span></span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(shadow.opacity * 100)}
              onChange={event => onChange({ shadow: { ...shadow, opacity: Math.max(0, Math.min(1, Number(event.target.value) / 100)) } } as Partial<PhoenixMediaLayer>)}
              className="mt-1 w-full"
            />
          </label>

          <label className="block text-[10px] uppercase text-slate-500">
            <span className="flex items-center justify-between"><span>Blur</span><span>{Math.round(shadow.blur)} px</span></span>
            <input
              type="range"
              min={0}
              max={120}
              value={shadow.blur}
              onChange={event => onChange({ shadow: { ...shadow, blur: Math.max(0, Number(event.target.value)) } } as Partial<PhoenixMediaLayer>)}
              className="mt-1 w-full"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] uppercase text-slate-500">Offset X
              <input
                type="number"
                min={-500}
                max={500}
                value={shadow.offsetX}
                onChange={event => onChange({ shadow: { ...shadow, offsetX: Number(event.target.value) } } as Partial<PhoenixMediaLayer>)}
                className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white"
              />
            </label>
            <label className="text-[10px] uppercase text-slate-500">Offset Y
              <input
                type="number"
                min={-500}
                max={500}
                value={shadow.offsetY}
                onChange={event => onChange({ shadow: { ...shadow, offsetY: Number(event.target.value) } } as Partial<PhoenixMediaLayer>)}
                className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white"
              />
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
