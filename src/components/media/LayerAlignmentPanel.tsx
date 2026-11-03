'use client';

import { Button } from '@/components/ui/Button';
import {
  alignLayerToCanvas,
  rotateLayerBy,
  type PhoenixLayerTransform,
  type PhoenixMediaDocument,
} from '@/lib/media-composition';

interface LayerAlignmentPanelProps {
  transform: PhoenixLayerTransform;
  document: Pick<PhoenixMediaDocument, 'width' | 'height'>;
  onCommit: (transform: PhoenixLayerTransform) => void;
}

export function LayerAlignmentPanel({ transform, document, onCommit }: LayerAlignmentPanelProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Align & Rotate</div>

      <div className="mt-3 grid grid-cols-3 gap-1">
        <Button size="sm" variant="ghost" onClick={() => onCommit(alignLayerToCanvas(transform, document, 'left'))}>Left</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit(alignLayerToCanvas(transform, document, 'center-x'))}>Center X</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit(alignLayerToCanvas(transform, document, 'right'))}>Right</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit(alignLayerToCanvas(transform, document, 'top'))}>Top</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit(alignLayerToCanvas(transform, document, 'center-y'))}>Center Y</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit(alignLayerToCanvas(transform, document, 'bottom'))}>Bottom</Button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        <Button size="sm" variant="ghost" onClick={() => onCommit(rotateLayerBy(transform, -90))}>↺ 90°</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit({ ...transform, rotation: 0 })}>Reset</Button>
        <Button size="sm" variant="ghost" onClick={() => onCommit(rotateLayerBy(transform, 90))}>↻ 90°</Button>
      </div>
    </section>
  );
}
