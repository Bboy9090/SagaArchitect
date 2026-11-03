'use client';

import { Button } from '@/components/ui/Button';
import { moveVectorPoint, type PhoenixPathLayer } from '@/lib/media-composition';

interface CompoundContourPanelProps {
  layer: PhoenixPathLayer;
  onChange: (patch: Partial<PhoenixPathLayer>) => void;
}

function defaultInsetContour(layer: PhoenixPathLayer) {
  const padX = Math.max(24, layer.transform.width * 0.25);
  const padY = Math.max(24, layer.transform.height * 0.25);
  const left = Math.min(padX, layer.transform.width / 2 - 1);
  const top = Math.min(padY, layer.transform.height / 2 - 1);
  const right = Math.max(left + 1, layer.transform.width - left);
  const bottom = Math.max(top + 1, layer.transform.height - top);
  return {
    id: crypto.randomUUID(),
    closed: true,
    points: [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
  };
}

export function CompoundContourPanel({ layer, onChange }: CompoundContourPanelProps) {
  const contours = layer.contours || [];

  const patchContour = (id: string, updater: (contour: NonNullable<PhoenixPathLayer['contours']>[number]) => NonNullable<PhoenixPathLayer['contours']>[number]) => {
    onChange({ contours: contours.map(contour => contour.id === id ? updater(contour) : contour) });
  };

  return (
    <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Compound Contours</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={!layer.closed}
          onClick={() => onChange({ contours: [...contours, defaultInsetContour(layer)], fillRule: 'evenodd' })}
        >
          Add Hole
        </Button>
      </div>
      <label className="mt-3 block text-[10px] uppercase text-slate-500">Fill rule
        <select
          value={layer.fillRule || (contours.length ? 'evenodd' : 'nonzero')}
          onChange={event => onChange({ fillRule: event.target.value as 'evenodd' | 'nonzero' })}
          className="mt-1 min-h-9 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white"
        >
          <option value="evenodd">Even-Odd (holes)</option>
          <option value="nonzero">Non-Zero</option>
        </select>
      </label>
      <div className="mt-3 space-y-3">
        {contours.map((contour, contourIndex) => (
          <div key={contour.id} className="rounded border border-white/10 bg-black/10 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">Contour {contourIndex + 2}</span>
              <Button size="sm" variant="ghost" onClick={() => onChange({ contours: contours.filter(item => item.id !== contour.id) })}>Remove</Button>
            </div>
            <div className="mt-2 space-y-2">
              {contour.points.map((point, pointIndex) => (
                <div key={pointIndex} className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={Math.round(point.x)}
                    aria-label={`Contour ${contourIndex + 2} node ${pointIndex + 1} X`}
                    onChange={event => {
                      const x = Math.max(0, Math.min(layer.transform.width, Number(event.target.value)));
                      patchContour(contour.id, current => ({
                        ...current,
                        points: current.points.map((item, index) => index === pointIndex ? moveVectorPoint(item, x, item.y) : item),
                      }));
                    }}
                    className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={Math.round(point.y)}
                    aria-label={`Contour ${contourIndex + 2} node ${pointIndex + 1} Y`}
                    onChange={event => {
                      const y = Math.max(0, Math.min(layer.transform.height, Number(event.target.value)));
                      patchContour(contour.id, current => ({
                        ...current,
                        points: current.points.map((item, index) => index === pointIndex ? moveVectorPoint(item, item.x, y) : item),
                      }));
                    }}
                    className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {contours.length === 0 && (
          <p className="text-[11px] leading-5 text-slate-600">
            {layer.closed
              ? 'Add a secondary closed contour to cut a transparent hole through this vector path.'
              : 'Close the primary path before adding hole contours.'}
          </p>
        )}
      </div>
    </section>
  );
}
