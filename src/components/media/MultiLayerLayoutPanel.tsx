'use client';

import { Button } from '@/components/ui/Button';

interface MultiLayerLayoutPanelProps {
  count: number;
  onAlign: (alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  onClear: () => void;
}

export function MultiLayerLayoutPanel({ count, onAlign, onDistribute, onClear }: MultiLayerLayoutPanelProps) {
  if (count < 2) return null;

  return (
    <section className="rounded-lg border border-teal-400/20 bg-teal-400/[0.04] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">{count} Layers Selected</span>
        <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1">
        <Button size="sm" variant="ghost" onClick={() => onAlign('left')}>Left</Button>
        <Button size="sm" variant="ghost" onClick={() => onAlign('center-x')}>Center X</Button>
        <Button size="sm" variant="ghost" onClick={() => onAlign('right')}>Right</Button>
        <Button size="sm" variant="ghost" onClick={() => onAlign('top')}>Top</Button>
        <Button size="sm" variant="ghost" onClick={() => onAlign('center-y')}>Center Y</Button>
        <Button size="sm" variant="ghost" onClick={() => onAlign('bottom')}>Bottom</Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Button size="sm" variant="ghost" disabled={count < 3} onClick={() => onDistribute('horizontal')}>Distribute X</Button>
        <Button size="sm" variant="ghost" disabled={count < 3} onClick={() => onDistribute('vertical')}>Distribute Y</Button>
      </div>
    </section>
  );
}
