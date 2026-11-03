'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RasterPaintCanvas } from '@/components/media/RasterPaintCanvas';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetAssets, dbGetProject, type ProjectAsset } from '@/lib/db-client';
import {
  clampLayerTransform,
  createPhoenixMediaDocument,
  loadPhoenixMediaDocument,
  nextLayerZIndex,
  savePhoenixMediaDocument,
  layerCssFilter,
  normalizeLayerAdjustments,
  type PhoenixMediaDocument,
  type PhoenixMediaLayer,
} from '@/lib/media-composition';
import {
  commitDocumentHistory,
  createDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory,
  type PhoenixDocumentHistory,
} from '@/lib/media-history';
import type { Universe } from '@/lib/types';

interface ImageStudioPageProps {
  params: Promise<{ id: string }>;
}

function layerMixBlendMode(mode: PhoenixMediaLayer['blendMode']): React.CSSProperties['mixBlendMode'] {
  return mode === 'normal' ? 'normal' : mode;
}

export default function ImageStudioPage({ params }: ImageStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [history, setHistory] = useState<PhoenixDocumentHistory | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState('');
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(24);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [eraseMode, setEraseMode] = useState(false);
  const [selection, setSelection] = useState({ x: 120, y: 120, width: 600, height: 600 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (cancelled) return;
        setProject(loadedProject);
        const loadedDocument = loadPhoenixMediaDocument(id, 'image') || createPhoenixMediaDocument(id, 'image');
        setHistory(createDocumentHistory(loadedDocument));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const document = history?.present || null;

  useEffect(() => {
    if (!document || loading) return;
    const handle = window.setTimeout(() => {
      const saved = savePhoenixMediaDocument(document);
      setSavedAt(saved.updatedAt);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [document, loading]);

  const sortedLayers = useMemo(
    () => [...(document?.layers || [])].sort((a, b) => a.zIndex - b.zIndex),
    [document?.layers],
  );

  const selectedLayer = document?.layers.find(layer => layer.id === selectedLayerId) || null;

  const updateDocument = (updater: (current: PhoenixMediaDocument) => PhoenixMediaDocument) => {
    setHistory(current => {
      if (!current) return current;
      return commitDocumentHistory(current, updater(current.present));
    });
  };

  const addTextLayer = () => {
    if (!document) return;
    const id = crypto.randomUUID();
    const layer: PhoenixMediaLayer = {
      id,
      type: 'text',
      name: 'Text',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 120, y: 120, width: 700, height: 160, rotation: 0 },
      text: 'Phoenix Creator Studio',
      color: '#ffffff',
      fontSize: 64,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 800,
      align: 'left',
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(id);
  };

  const addRasterLayer = () => {
    if (!document) return;
    const id = crypto.randomUUID();
    const layer: PhoenixMediaLayer = {
      id,
      type: 'raster',
      name: 'Paint Layer',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 0, y: 0, width: document.width, height: document.height, rotation: 0 },
      src: '',
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(id);
  };

  const addShapeLayer = (shape: 'rectangle' | 'ellipse') => {
    if (!document) return;
    const id = crypto.randomUUID();
    const layer: PhoenixMediaLayer = {
      id,
      type: 'shape',
      name: shape === 'rectangle' ? 'Rectangle' : 'Ellipse',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 240, y: 240, width: 480, height: 360, rotation: 0 },
      shape,
      fill: '#2563eb',
      stroke: '#60a5fa',
      strokeWidth: 0,
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(id);
  };

  const addAssetLayer = (asset: ProjectAsset) => {
    if (!document) return;
    const layerId = crypto.randomUUID();
    const layer: PhoenixMediaLayer = {
      id: layerId,
      type: 'image',
      name: asset.name,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 120, y: 120, width: 720, height: 720, rotation: 0 },
      assetId: asset.id,
      src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
      fit: 'contain',
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layerId);
  };

  const patchSelectedLayer = (patch: Partial<PhoenixMediaLayer>) => {
    if (!document || !selectedLayer) return;
    updateDocument(current => ({
      ...current,
      layers: current.layers.map(layer => {
        if (layer.id !== selectedLayer.id) return layer;
        const next = { ...layer, ...patch } as PhoenixMediaLayer;
        if (patch.transform) {
          next.transform = clampLayerTransform(
            { ...layer.transform, ...patch.transform },
            current,
          );
        }
        return next;
      }),
    }));
  };

  const patchTransform = (key: keyof PhoenixMediaLayer['transform'], value: number) => {
    if (!selectedLayer) return;
    patchSelectedLayer({ transform: { ...selectedLayer.transform, [key]: value } } as Partial<PhoenixMediaLayer>);
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    updateDocument(current => ({
      ...current,
      layers: current.layers.filter(layer => layer.id !== selectedLayer.id),
    }));
    setSelectedLayerId('');
  };

  const moveLayer = (direction: 1 | -1) => {
    if (!document || !selectedLayer) return;
    const ordered = [...document.layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex(layer => layer.id === selectedLayer.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const currentZ = ordered[index].zIndex;
    ordered[index] = { ...ordered[index], zIndex: ordered[swapIndex].zIndex };
    ordered[swapIndex] = { ...ordered[swapIndex], zIndex: currentZ };
    updateDocument(current => ({ ...current, layers: current.layers.map(layer => ordered.find(next => next.id === layer.id) || layer) }));
  };

  const normalizedSelection = () => {
    if (!document) return selection;
    const x = Math.max(0, Math.min(selection.x, document.width - 1));
    const y = Math.max(0, Math.min(selection.y, document.height - 1));
    const width = Math.max(1, Math.min(selection.width, document.width - x));
    const height = Math.max(1, Math.min(selection.height, document.height - y));
    return { x, y, width, height };
  };

  const cropCanvasToSelection = () => {
    if (!document) return;
    const selected = normalizedSelection();
    updateDocument(current => ({
      ...current,
      width: selected.width,
      height: selected.height,
      layers: current.layers.map(layer => ({
        ...layer,
        transform: {
          ...layer.transform,
          x: layer.transform.x - selected.x,
          y: layer.transform.y - selected.y,
        },
      })),
    }));
    setSelection({ x: 0, y: 0, width: selected.width, height: selected.height });
  };

  const maskLayerToSelection = () => {
    if (!selectedLayer) return;
    const selected = normalizedSelection();
    const left = Math.max(selected.x, selectedLayer.transform.x);
    const top = Math.max(selected.y, selectedLayer.transform.y);
    const right = Math.min(selected.x + selected.width, selectedLayer.transform.x + selectedLayer.transform.width);
    const bottom = Math.min(selected.y + selected.height, selectedLayer.transform.y + selectedLayer.transform.height);
    if (right <= left || bottom <= top) return;
    patchSelectedLayer({
      mask: {
        x: left - selectedLayer.transform.x,
        y: top - selectedLayer.transform.y,
        width: right - left,
        height: bottom - top,
      },
    } as Partial<PhoenixMediaLayer>);
  };

  const selectedLayerClipPath = (layer: PhoenixMediaLayer): string | undefined => {
    if (!layer.mask) return undefined;
    const top = Math.max(0, (layer.mask.y / layer.transform.height) * 100);
    const left = Math.max(0, (layer.mask.x / layer.transform.width) * 100);
    const right = Math.max(0, ((layer.transform.width - layer.mask.x - layer.mask.width) / layer.transform.width) * 100);
    const bottom = Math.max(0, ((layer.transform.height - layer.mask.y - layer.mask.height) / layer.transform.height) * 100);
    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  };

  if (loading || !document) {
    return (
      <Navigation>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner text="Opening Image Studio..." />
        </div>
      </Navigation>
    );
  }

  const scale = Math.min(1, 760 / document.width);

  return (
    <Navigation>
      <Header
        title="Image Studio"
        subtitle={`Layered image composition for ${project?.name || 'Phoenix production'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" disabled={!history || history.past.length === 0} onClick={() => setHistory(current => current ? undoDocumentHistory(current) : current)}>
              Undo
            </Button>
            <Button size="sm" variant="ghost" disabled={!history || history.future.length === 0} onClick={() => setHistory(current => current ? redoDocumentHistory(current) : current)}>
              Redo
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{document.width} × {document.height}</span>
              <span>•</span>
              <span>{savedAt ? 'Autosaved' : 'Ready'}</span>
            </div>
          </div>
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Create</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={addTextLayer}>Text</Button>
            <Button size="sm" variant="secondary" onClick={() => addShapeLayer('rectangle')}>Rectangle</Button>
            <Button size="sm" variant="secondary" onClick={() => addShapeLayer('ellipse')}>Ellipse</Button>
            <Button size="sm" variant="secondary" onClick={addRasterLayer}>Paint Layer</Button>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Selection</p>
            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map(key => (
                <label key={key} className="text-[10px] uppercase text-slate-500">{key}
                  <input
                    type="number"
                    min={key === 'width' || key === 'height' ? 1 : 0}
                    value={Math.round(selection[key])}
                    onChange={event => setSelection(current => ({ ...current, [key]: Number(event.target.value) }))}
                    className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <Button size="sm" variant="ghost" onClick={cropCanvasToSelection}>Crop Canvas to Selection</Button>
              <Button size="sm" variant="ghost" disabled={!selectedLayer} onClick={maskLayerToSelection}>Mask Selected Layer</Button>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Project Assets</p>
            {!isDbMode() ? (
              <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200/70">
                Asset placement uses Studio Cloud mode. Text and shape layers work in Personal Vault mode.
              </p>
            ) : assets.length === 0 ? (
              <p className="text-xs leading-5 text-slate-500">Upload images in the project Asset Library, then place them here as layers.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {assets.filter(asset => asset.mime_type.startsWith('image/')).map(asset => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => addAssetLayer(asset)}
                    className="overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left hover:border-blue-400/40"
                    title={`Add ${asset.name} as image layer`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.serve_url || `/api/db/assets/${asset.id}/serve`} alt="" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-2 py-1.5 text-[10px] text-slate-400">{asset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-violet-400/15 bg-violet-400/[0.04] p-3">
            <p className="text-xs font-bold text-violet-200">Foundation editor</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Layers, raster painting, selections, cropping, masks, and undo/redo now share one persistent document.
              Adjustment layers, filters, and GPU effects are the next image-engine tier.
            </p>
          </div>
        </aside>

        <main className="overflow-auto bg-[#04060b] p-4 md:p-8">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div
              className="relative origin-center overflow-hidden border border-white/15 shadow-2xl"
              style={{
                width: document.width * scale,
                height: document.height * scale,
                background: document.background,
              }}
              aria-label="Image composition canvas"
            >
              {sortedLayers.map(layer => {
                if (!layer.visible) return null;
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: layer.transform.x * scale,
                  top: layer.transform.y * scale,
                  width: layer.transform.width * scale,
                  height: layer.transform.height * scale,
                  opacity: layer.opacity,
                  transform: `rotate(${layer.transform.rotation}deg)`,
                  transformOrigin: 'center',
                  mixBlendMode: layerMixBlendMode(layer.blendMode),
                  outline: selectedLayerId === layer.id ? '2px solid #60a5fa' : undefined,
                  outlineOffset: 2,
                  cursor: layer.locked ? 'not-allowed' : 'pointer',
                  clipPath: selectedLayerClipPath(layer),
                  filter: layerCssFilter(layer),
                };

                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className="block border-0 bg-transparent p-0 text-left"
                    style={style}
                    aria-label={`Select layer ${layer.name}`}
                  >
                    {layer.type === 'text' && (
                      <div
                        className="h-full w-full overflow-hidden"
                        style={{
                          color: layer.color,
                          fontSize: layer.fontSize * scale,
                          fontFamily: layer.fontFamily,
                          fontWeight: layer.fontWeight,
                          textAlign: layer.align,
                          lineHeight: 1.05,
                        }}
                      >
                        {layer.text}
                      </div>
                    )}
                    {layer.type === 'shape' && (
                      <div
                        className="h-full w-full"
                        style={{
                          background: layer.fill,
                          border: layer.strokeWidth ? `${Math.max(1, layer.strokeWidth * scale)}px solid ${layer.stroke}` : undefined,
                          borderRadius: layer.shape === 'ellipse' ? '9999px' : 0,
                        }}
                      />
                    )}
                    {layer.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: layer.fit }} />
                    )}
                    {layer.type === 'raster' && (
                      <RasterPaintCanvas
                        layer={layer}
                        scale={scale}
                        selected={selectedLayerId === layer.id}
                        brushColor={brushColor}
                        brushSize={brushSize}
                        brushOpacity={brushOpacity}
                        erase={eraseMode}
                        onSelect={() => setSelectedLayerId(layer.id)}
                        onCommit={(src) => {
                          updateDocument(current => ({
                            ...current,
                            layers: current.layers.map(item => item.id === layer.id ? { ...item, src } : item),
                          }));
                        }}
                      />
                    )}
                  </button>
                );
              })}
              <div
                className="pointer-events-none absolute z-[10000] border-2 border-dashed border-cyan-300 bg-cyan-300/5"
                style={{
                  left: normalizedSelection().x * scale,
                  top: normalizedSelection().y * scale,
                  width: normalizedSelection().width * scale,
                  height: normalizedSelection().height * scale,
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <div className="mb-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Layers</p>
            <div className="space-y-2">
              {[...sortedLayers].reverse().map(layer => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-xs ${selectedLayerId === layer.id
                    ? 'border-blue-400/50 bg-blue-400/10 text-blue-100'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/15'}`}
                >
                  <span className="truncate">{layer.visible ? '◉' : '○'} {layer.name}</span>
                  <span className="text-[9px] uppercase text-slate-600">{layer.type}</span>
                </button>
              ))}
              {sortedLayers.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">
                  Add a layer to begin.
                </p>
              )}
            </div>
          </div>

          {selectedLayer && (
            <div className="space-y-4 border-t border-white/10 pt-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Layer name</label>
                <input
                  value={selectedLayer.name}
                  onChange={event => patchSelectedLayer({ name: event.target.value })}
                  className="mt-1 min-h-10 w-full rounded border border-white/10 bg-black/20 px-3 text-sm text-white"
                />
              </div>

              {selectedLayer.type === 'text' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Text</label>
                    <textarea
                      value={selectedLayer.text}
                      onChange={event => patchSelectedLayer({ text: event.target.value } as Partial<PhoenixMediaLayer>)}
                      className="mt-1 min-h-20 w-full rounded border border-white/10 bg-black/20 p-3 text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase text-slate-500">Size
                      <input type="number" min={8} max={300} value={selectedLayer.fontSize} onChange={event => patchSelectedLayer({ fontSize: Number(event.target.value) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Color
                      <input type="color" value={selectedLayer.color} onChange={event => patchSelectedLayer({ color: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                    </label>
                  </div>
                </>
              )}

              {selectedLayer.type === 'raster' && (
                <div className="space-y-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase text-slate-500">Brush
                      <input type="number" min={1} max={300} value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Opacity %
                      <input type="number" min={1} max={100} value={Math.round(brushOpacity * 100)} onChange={event => setBrushOpacity(Math.max(0.01, Math.min(1, Number(event.target.value) / 100)))} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                  </div>
                  <label className="block text-[10px] uppercase text-slate-500">Brush Color
                    <input type="color" value={brushColor} onChange={event => setBrushColor(event.target.value)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                  </label>
                  <Button size="sm" variant={eraseMode ? 'gold' : 'ghost'} className="w-full" onClick={() => setEraseMode(value => !value)}>
                    {eraseMode ? 'Erase Mode On' : 'Enable Eraser'}
                  </Button>
                </div>
              )}

              {selectedLayer.type === 'shape' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] uppercase text-slate-500">Fill
                    <input type="color" value={selectedLayer.fill} onChange={event => patchSelectedLayer({ fill: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                  </label>
                  <label className="text-[10px] uppercase text-slate-500">Stroke
                    <input type="color" value={selectedLayer.stroke} onChange={event => patchSelectedLayer({ stroke: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map(key => (
                  <label key={key} className="text-[10px] uppercase text-slate-500">{key}
                    <input
                      type="number"
                      value={Math.round(selectedLayer.transform[key])}
                      onChange={event => patchTransform(key, Number(event.target.value))}
                      className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase text-slate-500">Rotation
                  <input type="number" value={selectedLayer.transform.rotation} onChange={event => patchTransform('rotation', Number(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">Opacity
                  <input type="number" min={0} max={100} value={Math.round(selectedLayer.opacity * 100)} onChange={event => patchSelectedLayer({ opacity: Math.max(0, Math.min(1, Number(event.target.value) / 100)) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
              </div>

              <label className="block text-[10px] uppercase text-slate-500">Blend
                <select value={selectedLayer.blendMode} onChange={event => patchSelectedLayer({ blendMode: event.target.value as PhoenixMediaLayer['blendMode'] })} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-white">
                  <option value="normal">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                </select>
              </label>

              <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-3">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-violet-300">Adjustments</div>
                <div className="space-y-2">
                  {([
                    ['brightness', 'Brightness', 0, 200],
                    ['contrast', 'Contrast', 0, 200],
                    ['saturation', 'Saturation', 0, 200],
                    ['grayscale', 'Grayscale', 0, 100],
                    ['sepia', 'Sepia', 0, 100],
                    ['blur', 'Blur', 0, 30],
                  ] as const).map(([key, label, min, max]) => {
                    const adjustments = normalizeLayerAdjustments(selectedLayer);
                    return (
                      <label key={key} className="block text-[10px] uppercase text-slate-500">
                        <span className="flex items-center justify-between"><span>{label}</span><span>{Math.round(adjustments[key])}</span></span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={key === 'blur' ? 0.5 : 1}
                          value={adjustments[key]}
                          onChange={event => patchSelectedLayer({
                            adjustments: {
                              ...adjustments,
                              [key]: Number(event.target.value),
                            },
                          } as Partial<PhoenixMediaLayer>)}
                          className="mt-1 w-full"
                        />
                      </label>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-3 w-full"
                  onClick={() => patchSelectedLayer({ adjustments: undefined })}
                >
                  Reset Adjustments
                </Button>
              </div>

              {selectedLayer.mask && (
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Layer Mask Active</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {Math.round(selectedLayer.mask.width)} × {Math.round(selectedLayer.mask.height)}
                  </div>
                  <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => patchSelectedLayer({ mask: undefined })}>
                    Clear Mask
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" onClick={() => patchSelectedLayer({ visible: !selectedLayer.visible })}>
                  {selectedLayer.visible ? 'Hide' : 'Show'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => patchSelectedLayer({ locked: !selectedLayer.locked })}>
                  {selectedLayer.locked ? 'Unlock' : 'Lock'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => moveLayer(1)}>Move Up</Button>
                <Button size="sm" variant="ghost" onClick={() => moveLayer(-1)}>Move Down</Button>
              </div>

              <Button size="sm" variant="danger" className="w-full" onClick={deleteSelectedLayer}>Delete Layer</Button>
            </div>
          )}
        </aside>
      </div>
    </Navigation>
  );
}
