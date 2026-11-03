'use client';

interface MediaViewportToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  snap: boolean;
  onToggleSnap: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
}

export function MediaViewportToolbar({
  zoom,
  onZoomChange,
  onFit,
  showGuides,
  onToggleGuides,
  snap,
  onToggleSnap,
  showRulers,
  onToggleRulers,
}: MediaViewportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#090d17] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
        <button type="button" onClick={onToggleGuides} className="min-h-9 rounded px-2 hover:bg-white/5">
          {showGuides ? 'Guides on' : 'Guides off'}
        </button>
        <button type="button" onClick={onToggleSnap} className="min-h-9 rounded px-2 hover:bg-white/5">
          {snap ? 'Snap 10px' : 'Snap off'}
        </button>
        <button type="button" onClick={onToggleRulers} className="min-h-9 rounded px-2 hover:bg-white/5">
          {showRulers ? 'Rulers on' : 'Rulers off'}
        </button>
        <button type="button" onClick={onFit} className="min-h-9 rounded px-2 hover:bg-white/5">
          Fit
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Zoom out" onClick={() => onZoomChange(zoom - 0.1)} className="h-9 w-9 rounded border border-white/10 text-white">−</button>
        <input
          aria-label="Canvas zoom"
          type="range"
          min={10}
          max={400}
          step={5}
          value={Math.round(zoom * 100)}
          onChange={event => onZoomChange(Number(event.target.value) / 100)}
          className="w-28"
        />
        <span className="w-14 text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => onZoomChange(zoom + 0.1)} className="h-9 w-9 rounded border border-white/10 text-white">+</button>
      </div>
    </div>
  );
}
