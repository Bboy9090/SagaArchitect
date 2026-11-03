'use client';

import { Button } from '@/components/ui/Button';
import {
  defaultVectorMask,
  moveVectorPoint,
  type PhoenixMediaLayer,
} from '@/lib/media-composition';

interface VectorMaskPanelProps {
  layer: PhoenixMediaLayer;
  onChange: (patch: Partial<PhoenixMediaLayer>) => void;
}

export function VectorMaskPanel({ layer, onChange }: VectorMaskPanelProps) {
  const mask = layer.vectorMask;

  if (!mask) {
    return (
      <section className="rounded-lg border border-sky-400/20 bg-sky-400/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">Vector Mask</div>
            <div className="mt-1 text-[11px] leading-5 text-slate-600">Clip this layer with an editable polygon without flattening it.</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({
              mask: undefined,
              vectorMask: defaultVectorMask(layer.transform.width, layer.transform.height),
            } as Partial<PhoenixMediaLayer>)}
          >
            Add Mask
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-sky-400/20 bg-sky-400/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-sky-300">Vector Mask Nodes</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ vectorMask: defaultVectorMask(layer.transform.width, layer.transform.height) } as Partial<PhoenixMediaLayer>)}
          >
            Reset
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange({ vectorMask: undefined } as Partial<PhoenixMediaLayer>)}>
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {mask.points.map((point, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              type="number"
              value={Math.round(point.x)}
              aria-label={`Vector mask node ${index + 1} X`}
              onChange={event => {
                const x = Math.max(0, Math.min(layer.transform.width, Number(event.target.value)));
                onChange({
                  vectorMask: {
                    points: mask.points.map((item, pointIndex) => pointIndex === index
                      ? moveVectorPoint(item, x, item.y)
                      : item),
                  },
                } as Partial<PhoenixMediaLayer>);
              }}
              className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
            />
            <input
              type="number"
              value={Math.round(point.y)}
              aria-label={`Vector mask node ${index + 1} Y`}
              onChange={event => {
                const y = Math.max(0, Math.min(layer.transform.height, Number(event.target.value)));
                onChange({
                  vectorMask: {
                    points: mask.points.map((item, pointIndex) => pointIndex === index
                      ? moveVectorPoint(item, item.x, y)
                      : item),
                  },
                } as Partial<PhoenixMediaLayer>);
              }}
              className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={mask.points.length <= 3}
              onClick={() => onChange({
                vectorMask: { points: mask.points.filter((_, pointIndex) => pointIndex !== index) },
              } as Partial<PhoenixMediaLayer>)}
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="mt-3 w-full"
        onClick={() => {
          const first = mask.points[0];
          const last = mask.points[mask.points.length - 1];
          onChange({
            vectorMask: {
              points: [
                ...mask.points,
                { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
              ],
            },
          } as Partial<PhoenixMediaLayer>);
        }}
      >
        Add Node
      </Button>
    </section>
  );
}
