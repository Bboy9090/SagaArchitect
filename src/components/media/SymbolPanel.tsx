'use client';

import { Button } from '@/components/ui/Button';
import type { PhoenixMediaLayer, PhoenixSymbolDefinition } from '@/lib/media-composition';

interface SymbolPanelProps {
  symbols: PhoenixSymbolDefinition[];
  selectedLayer: PhoenixMediaLayer | null;
  onCreateFromSelected: () => void;
  onInsert: (symbolId: string) => void;
  onSelectMaster: (layerId: string) => void;
  onDetachSelected: () => void;
}

export function SymbolPanel({
  symbols,
  selectedLayer,
  onCreateFromSelected,
  onInsert,
  onSelectMaster,
  onDetachSelected,
}: SymbolPanelProps) {
  const selectedSymbol = selectedLayer?.symbolId
    ? symbols.find(symbol => symbol.id === selectedLayer.symbolId)
    : undefined;
  const selectedMaster = selectedLayer
    ? symbols.find(symbol => symbol.masterLayerId === selectedLayer.id)
    : undefined;

  return (
    <section className="rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-violet-300">Linked Symbols</p>
        <Button
          size="sm"
          variant="ghost"
          disabled={!selectedLayer || Boolean(selectedLayer.symbolId) || Boolean(selectedMaster)}
          onClick={onCreateFromSelected}
        >
          Make Symbol
        </Button>
      </div>

      {selectedSymbol && (
        <div className="mt-3 rounded-lg border border-violet-300/20 bg-black/20 p-2">
          <div className="text-[10px] font-bold uppercase text-violet-200">Linked instance</div>
          <div className="mt-1 truncate text-xs text-white">{selectedSymbol.name}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant="ghost" onClick={() => onSelectMaster(selectedSymbol.masterLayerId)}>Select Master</Button>
            <Button size="sm" variant="ghost" onClick={onDetachSelected}>Detach</Button>
          </div>
        </div>
      )}

      {selectedMaster && (
        <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-2 text-[11px] leading-5 text-amber-100/80">
          This is the master for <strong>{selectedMaster.name}</strong>. Content/style edits propagate to every linked instance.
        </div>
      )}

      <div className="mt-3 space-y-2">
        {symbols.map(symbol => (
          <div key={symbol.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
            <button type="button" onClick={() => onSelectMaster(symbol.masterLayerId)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-xs font-semibold text-white">{symbol.name}</div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Master linked</div>
            </button>
            <Button size="sm" variant="ghost" onClick={() => onInsert(symbol.id)}>Insert</Button>
          </div>
        ))}
        {symbols.length === 0 && (
          <p className="text-[11px] leading-5 text-slate-600">
            Select a text, shape, image, raster, or vector layer and turn it into a reusable linked symbol.
          </p>
        )}
      </div>
    </section>
  );
}
