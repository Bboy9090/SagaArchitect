'use client';

import { Button } from '@/components/ui/Button';
import {
  normalizeLayerAdjustments,
  type PhoenixAdjustmentLayer,
  type PhoenixMediaLayer,
} from '@/lib/media-composition';

interface AdjustmentLayerPanelProps {
  layer: PhoenixAdjustmentLayer;
  onChange: (patch: Partial<PhoenixMediaLayer>) => void;
}

export function AdjustmentLayerPanel({ layer, onChange }: AdjustmentLayerPanelProps) {
  const adjustments = normalizeLayerAdjustments(layer);

  return (
    <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Adjustment Layer</div>
      <div className="mt-3 space-y-2">
        {([
          ['brightness', 'Brightness', 0, 200],
          ['contrast', 'Contrast', 0, 200],
          ['saturation', 'Saturation', 0, 200],
          ['grayscale', 'Grayscale', 0, 100],
          ['sepia', 'Sepia', 0, 100],
          ['invert', 'Invert', 0, 100],
          ['hueRotate', 'Hue', -180, 180],
          ['blur', 'Blur', 0, 30],
        ] as const).map(([key, label, min, max]) => (
          <label key={key} className="block text-[10px] uppercase text-slate-500">
            <span className="flex items-center justify-between"><span>{label}</span><span>{Math.round(adjustments[key])}</span></span>
            <input
              type="range"
              min={min}
              max={max}
              step={key === 'blur' ? 0.5 : 1}
              value={adjustments[key]}
              onChange={event => onChange({
                adjustments: { ...adjustments, [key]: Number(event.target.value) },
              } as Partial<PhoenixMediaLayer>)}
              className="mt-1 w-full"
            />
          </label>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="mt-3 w-full"
        onClick={() => onChange({
          adjustments: {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            grayscale: 0,
            sepia: 0,
            invert: 0,
            hueRotate: 0,
            blur: 0,
          },
        } as Partial<PhoenixMediaLayer>)}
      >
        Reset Adjustment
      </Button>
    </section>
  );
}
