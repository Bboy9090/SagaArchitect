'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { MediaRevisionPanel } from '@/components/media/MediaRevisionPanel';
import { Spinner } from '@/components/ui/Spinner';
import { RasterPaintCanvas } from '@/components/media/RasterPaintCanvas';
import { VectorInkCanvas } from '@/components/media/VectorInkCanvas';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetAssets, dbGetMediaDocument, dbGetProject, dbSaveMediaDocument, type ProjectAsset } from '@/lib/db-client';
import {
  createPhoenixMediaDocument,
  loadPhoenixMediaDocument,
  nextLayerZIndex,
  savePhoenixMediaDocument,
  type PhoenixMediaDocument,
  type PhoenixMediaLayer,
  type PhoenixPathLayer,
  type PhoenixVectorPoint,
} from '@/lib/media-composition';
import {
  commitDocumentHistory,
  createDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory,
  type PhoenixDocumentHistory,
} from '@/lib/media-history';
import { downloadMediaBlob, exportPhoenixMediaDocument } from '@/lib/media-renderer';
import type { Universe } from '@/lib/types';

interface IllustrationStudioPageProps {
  params: Promise<{ id: string }>;
}

type BrushPreset = 'pencil' | 'ink' | 'paint';
type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'both';
type PerspectiveGuideMode = 'off' | 'one-point' | 'two-point';

const BRUSH_PRESETS: Record<BrushPreset, { size: number; opacity: number; label: string }> = {
  pencil: { size: 8, opacity: 0.45, label: 'Pencil' },
  ink: { size: 14, opacity: 1, label: 'Ink' },
  paint: { size: 44, opacity: 0.72, label: 'Paint' },
};

export default function IllustrationStudioPage({ params }: IllustrationStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [history, setHistory] = useState<PhoenixDocumentHistory | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [brushPreset, setBrushPreset] = useState<BrushPreset>('ink');
  const [brushColor, setBrushColor] = useState('#f8fafc');
  const [brushSize, setBrushSize] = useState(BRUSH_PRESETS.ink.size);
  const [brushOpacity, setBrushOpacity] = useState(BRUSH_PRESETS.ink.opacity);
  const [eraseMode, setEraseMode] = useState(false);
  const [vectorInkMode, setVectorInkMode] = useState(false);
  const [vectorInkColor, setVectorInkColor] = useState('#f8fafc');
  const [vectorInkWidth, setVectorInkWidth] = useState(8);
  const [stabilization, setStabilization] = useState(0.35);
  const [symmetry, setSymmetry] = useState<SymmetryMode>('none');
  const [perspectiveMode, setPerspectiveMode] = useState<PerspectiveGuideMode>('off');
  const [horizonPercent, setHorizonPercent] = useState(50);
  const [leftVanishingPercent, setLeftVanishingPercent] = useState(25);
  const [rightVanishingPercent, setRightVanishingPercent] = useState(75);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (cancelled) return;
        setProject(loadedProject);
        const localDocument = loadPhoenixMediaDocument(id, 'illustration');
        const cloudDocument = isDbMode() ? await dbGetMediaDocument(id, 'illustration') : null;
        const loadedDocument = cloudDocument || localDocument || createPhoenixMediaDocument(id, 'illustration');
        setHistory(createDocumentHistory({
          ...loadedDocument,
          title: loadedDocument.title === 'Untitled Composition' ? 'Untitled Illustration' : loadedDocument.title,
          background: loadedDocument.background || '#0f172a',
        }));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const document = history?.present || null;
  const selectedLayer = document?.layers.find(layer => layer.id === selectedLayerId) || null;
  const sortedLayers = useMemo(
    () => [...(document?.layers || [])].sort((a, b) => a.zIndex - b.zIndex),
    [document?.layers],
  );

  useEffect(() => {
    if (!document || loading) return;
    const handle = window.setTimeout(() => {
      const saved = savePhoenixMediaDocument(document);
      if (isDbMode()) {
        void dbSaveMediaDocument(id, saved)
          .catch(error => console.error('Phoenix cloud media autosave failed:', error));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [document, id, loading]);

  const updateDocument = (updater: (current: PhoenixMediaDocument) => PhoenixMediaDocument) => {
    setHistory(current => current ? commitDocumentHistory(current, updater(current.present)) : current);
  };

  const addPaintLayer = () => {
    if (!document) return;
    const layerId = crypto.randomUUID();
    const layer: PhoenixMediaLayer = {
      id: layerId,
      type: 'raster',
      name: `Paint Layer ${document.layers.filter(item => item.type === 'raster').length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 0, y: 0, width: document.width, height: document.height, rotation: 0 },
      src: '',
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layerId);
  };

  const addVectorInkLayer = () => {
    if (!document) return;
    const layerId = crypto.randomUUID();
    const layer: PhoenixPathLayer = {
      id: layerId,
      type: 'path',
      name: `Vector Ink ${document.layers.filter(item => item.type === 'path').length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 0, y: 0, width: document.width, height: document.height, rotation: 0 },
      points: [],
      contours: [],
      closed: false,
      fill: 'transparent',
      stroke: vectorInkColor,
      strokeWidth: vectorInkWidth,
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layerId);
    setVectorInkMode(true);
    setEraseMode(false);
  };

  const commitVectorStroke = (layerId: string, points: PhoenixVectorPoint[]) => {
    updateDocument(current => ({
      ...current,
      layers: current.layers.map(layer => {
        if (layer.id !== layerId || layer.type !== 'path') return layer;
        if (layer.points.length === 0) {
          return {
            ...layer,
            points,
            stroke: vectorInkColor,
            strokeWidth: vectorInkWidth,
          };
        }
        return {
          ...layer,
          contours: [...(layer.contours || []), { id: crypto.randomUUID(), points, closed: false }],
          stroke: vectorInkColor,
          strokeWidth: vectorInkWidth,
        };
      }),
    }));
  };

  const addReferenceLayer = (asset: ProjectAsset) => {
    if (!document) return;
    const layerId = crypto.randomUUID();
    const layer: PhoenixMediaLayer = {
      id: layerId,
      type: 'image',
      name: `Reference: ${asset.name}`,
      visible: true,
      locked: true,
      opacity: 0.45,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 0, y: 0, width: document.width, height: document.height, rotation: 0 },
      assetId: asset.id,
      src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
      fit: 'contain',
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layerId);
  };

  const patchSelectedLayer = (patch: Partial<PhoenixMediaLayer>) => {
    if (!selectedLayer) return;
    updateDocument(current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === selectedLayer.id ? ({ ...layer, ...patch } as PhoenixMediaLayer) : layer),
    }));
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    updateDocument(current => ({ ...current, layers: current.layers.filter(layer => layer.id !== selectedLayer.id) }));
    setSelectedLayerId('');
  };

  const chooseBrush = (preset: BrushPreset) => {
    const next = BRUSH_PRESETS[preset];
    setBrushPreset(preset);
    setBrushSize(next.size);
    setBrushOpacity(next.opacity);
    setEraseMode(false);
  };

  const exportPng = async () => {
    if (!document || exporting) return;
    setExporting(true);
    setStatus('');
    try {
      const blob = await exportPhoenixMediaDocument(document, 'png');
      downloadMediaBlob(blob, document.title || 'phoenix-illustration', 'png');
      setStatus('Flattened PNG exported.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !document || !history) {
    return (
      <Navigation>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner text="Opening Illustration Studio..." />
        </div>
      </Navigation>
    );
  }

  const scale = Math.min(0.72, 800 / Math.max(document.width, document.height));
  const imageAssets = assets.filter(asset => asset.mime_type.startsWith('image/'));

  return (
    <Navigation>
      <Header
        title="Illustration Studio"
        subtitle={`Pressure-aware drawing and painting for ${project?.name || 'Phoenix project'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={history.past.length === 0} onClick={() => setHistory(current => current ? undoDocumentHistory(current) : current)}>Undo</Button>
            <Button size="sm" variant="ghost" disabled={history.future.length === 0} onClick={() => setHistory(current => current ? redoDocumentHistory(current) : current)}>Redo</Button>
            <MediaRevisionPanel
              projectId={id}
              kind={document.kind}
              currentVersion={document.version}
              enabled={isDbMode()}
              onRestore={restored => {
                setHistory(createDocumentHistory(restored));
                setSelectedLayerId('');
                
              }}
              onError={setStatus}
            />
            <Button size="sm" variant="gold" loading={exporting} onClick={() => void exportPng()}>Export PNG</Button>
          </div>
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 2xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Brushes</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(BRUSH_PRESETS) as BrushPreset[]).map(preset => (
              <Button key={preset} size="sm" variant={brushPreset === preset && !eraseMode ? 'gold' : 'ghost'} onClick={() => chooseBrush(preset)}>
                {BRUSH_PRESETS[preset].label}
              </Button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-[10px] uppercase text-slate-500">Brush color
              <input type="color" value={brushColor} onChange={event => setBrushColor(event.target.value)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
            </label>
            <label className="block text-[10px] uppercase text-slate-500">Size {Math.round(brushSize)} px
              <input type="range" min={1} max={240} value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} className="mt-1 w-full" />
            </label>
            <label className="block text-[10px] uppercase text-slate-500">Opacity {Math.round(brushOpacity * 100)}%
              <input type="range" min={0.05} max={1} step={0.05} value={brushOpacity} onChange={event => setBrushOpacity(Number(event.target.value))} className="mt-1 w-full" />
            </label>
            <label className="block text-[10px] uppercase text-slate-500">Stabilization {Math.round(stabilization * 100)}%
              <input type="range" min={0} max={0.9} step={0.05} value={stabilization} onChange={event => setStabilization(Number(event.target.value))} className="mt-1 w-full" />
            </label>
            <label className="block text-[10px] uppercase text-slate-500">Symmetry
              <select value={symmetry} onChange={event => setSymmetry(event.target.value as SymmetryMode)} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-[#0a0d14] px-3 text-white">
                <option value="none">Off</option>
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
                <option value="both">Four-way</option>
              </select>
            </label>
            <label className="block text-[10px] uppercase text-slate-500">Perspective guides
              <select value={perspectiveMode} onChange={event => setPerspectiveMode(event.target.value as PerspectiveGuideMode)} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-[#0a0d14] px-3 text-white">
                <option value="off">Off</option>
                <option value="one-point">One-point</option>
                <option value="two-point">Two-point</option>
              </select>
            </label>
            {perspectiveMode !== 'off' && (
              <div className="space-y-3 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.03] p-3">
                <label className="block text-[10px] uppercase text-slate-500">Horizon {Math.round(horizonPercent)}%
                  <input type="range" min={5} max={95} value={horizonPercent} onChange={event => setHorizonPercent(Number(event.target.value))} className="mt-1 w-full" />
                </label>
                <label className="block text-[10px] uppercase text-slate-500">{perspectiveMode === 'one-point' ? 'Vanishing point' : 'Left vanishing point'} {Math.round(leftVanishingPercent)}%
                  <input type="range" min={0} max={100} value={leftVanishingPercent} onChange={event => setLeftVanishingPercent(Number(event.target.value))} className="mt-1 w-full" />
                </label>
                {perspectiveMode === 'two-point' && (
                  <label className="block text-[10px] uppercase text-slate-500">Right vanishing point {Math.round(rightVanishingPercent)}%
                    <input type="range" min={0} max={100} value={rightVanishingPercent} onChange={event => setRightVanishingPercent(Number(event.target.value))} className="mt-1 w-full" />
                  </label>
                )}
              </div>
            )}
            <Button className="w-full" size="sm" variant={eraseMode ? 'gold' : 'ghost'} onClick={() => { setEraseMode(value => !value); setVectorInkMode(false); }}>
              {eraseMode ? 'Eraser On' : 'Eraser'}
            </Button>
            <div className="rounded-lg border border-violet-400/10 bg-violet-400/[0.03] p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[.22em] text-violet-300/70">Vector ink</div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase text-slate-500">Ink color
                  <input type="color" value={vectorInkColor} onChange={event => setVectorInkColor(event.target.value)} className="mt-1 h-9 w-full rounded border border-white/10 bg-black/20 p-1" />
                </label>
                <label className="block text-[10px] uppercase text-slate-500">Ink width {Math.round(vectorInkWidth)} px
                  <input type="range" min={1} max={48} value={vectorInkWidth} onChange={event => setVectorInkWidth(Number(event.target.value))} className="mt-1 w-full" />
                </label>
                <Button className="w-full" size="sm" variant={vectorInkMode ? 'gold' : 'ghost'} onClick={() => setVectorInkMode(value => !value)}>
                  {vectorInkMode ? 'Vector Ink On' : 'Vector Ink Mode'}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2">
            <Button className="w-full" size="sm" variant="secondary" onClick={addPaintLayer}>+ Paint Layer</Button>
            <Button className="w-full" size="sm" variant="secondary" onClick={addVectorInkLayer}>+ Vector Ink Layer</Button>
          </div>

          {isDbMode() && (
            <div className="mt-6">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">References</p>
              <div className="grid grid-cols-2 gap-2">
                {imageAssets.slice(0, 12).map(asset => (
                  <button key={asset.id} type="button" onClick={() => addReferenceLayer(asset)} className="overflow-hidden rounded-lg border border-white/10 hover:border-blue-400/40" title={`Add ${asset.name} as reference`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.serve_url || `/api/db/assets/${asset.id}/serve`} alt="" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-2 py-1 text-[9px] text-slate-500">{asset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {status && <p className="mt-4 text-xs leading-5 text-slate-400">{status}</p>}
        </aside>

        <main className="overflow-auto bg-[#04060b] p-6">
          <div className="flex min-h-full items-center justify-center">
            <div
              className="relative overflow-hidden border border-white/15 shadow-2xl"
              style={{
                width: document.width * scale,
                height: document.height * scale,
                background: document.background,
              }}
              aria-label="Illustration canvas"
            >
              {(symmetry === 'vertical' || symmetry === 'both') && <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-[9999] w-px bg-cyan-300/40" />}
              {(symmetry === 'horizontal' || symmetry === 'both') && <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-[9999] h-px bg-cyan-300/40" />}
              {perspectiveMode !== 'off' && (
                <svg
                  className="pointer-events-none absolute inset-0 z-[9998] h-full w-full"
                  viewBox={`0 0 ${document.width} ${document.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {(() => {
                    const horizonY = document.height * (horizonPercent / 100);
                    const leftX = document.width * (leftVanishingPercent / 100);
                    const rightX = document.width * (rightVanishingPercent / 100);
                    const rays = [0, document.height * 0.2, document.height * 0.4, document.height * 0.6, document.height * 0.8, document.height];
                    return (
                      <>
                        <line x1={0} y1={horizonY} x2={document.width} y2={horizonY} stroke="rgba(103,232,249,0.72)" strokeWidth={2 / scale} />
                        {rays.map((y, index) => (
                          <line key={`left-${index}`} x1={leftX} y1={horizonY} x2={index % 2 === 0 ? 0 : document.width} y2={y} stroke="rgba(103,232,249,0.3)" strokeWidth={1 / scale} />
                        ))}
                        <circle cx={leftX} cy={horizonY} r={5 / scale} fill="rgba(103,232,249,0.95)" />
                        {perspectiveMode === 'two-point' && (
                          <>
                            {rays.map((y, index) => (
                              <line key={`right-${index}`} x1={rightX} y1={horizonY} x2={index % 2 === 0 ? document.width : 0} y2={y} stroke="rgba(167,139,250,0.3)" strokeWidth={1 / scale} />
                            ))}
                            <circle cx={rightX} cy={horizonY} r={5 / scale} fill="rgba(167,139,250,0.95)" />
                          </>
                        )}
                      </>
                    );
                  })()}
                </svg>
              )}
              {sortedLayers.map(layer => {
                if (!layer.visible) return null;
                const wrapperStyle: React.CSSProperties = {
                  position: 'absolute',
                  left: layer.transform.x * scale,
                  top: layer.transform.y * scale,
                  width: layer.transform.width * scale,
                  height: layer.transform.height * scale,
                  opacity: layer.opacity,
                  transform: `rotate(${layer.transform.rotation}deg)`,
                  transformOrigin: 'center',
                  mixBlendMode: layer.blendMode === 'normal' ? 'normal' : layer.blendMode,
                };

                if (layer.type === 'raster') {
                  return (
                    <div key={layer.id} style={wrapperStyle}>
                      <RasterPaintCanvas
                        layer={layer}
                        scale={scale}
                        selected={selectedLayerId === layer.id}
                        brushColor={brushColor}
                        brushSize={brushSize}
                        brushOpacity={brushOpacity}
                        erase={eraseMode}
                        stabilization={stabilization}
                        symmetry={symmetry}
                        onSelect={() => setSelectedLayerId(layer.id)}
                        onCommit={src => {
                          updateDocument(current => ({
                            ...current,
                            layers: current.layers.map(item => item.id === layer.id ? { ...item, src } : item),
                          }));
                        }}
                      />
                    </div>
                  );
                }

                if (layer.type === 'path') {
                  return (
                    <div key={layer.id} style={wrapperStyle}>
                      <VectorInkCanvas
                        layer={layer}
                        scale={scale}
                        selected={selectedLayerId === layer.id}
                        stroke={vectorInkColor}
                        strokeWidth={vectorInkWidth}
                        onSelect={() => setSelectedLayerId(layer.id)}
                        onCommitStroke={points => {
                          if (!vectorInkMode) return;
                          commitVectorStroke(layer.id, points);
                        }}
                      />
                    </div>
                  );
                }

                if (layer.type === 'image') {
                  return (
                    <button key={layer.id} type="button" onClick={() => setSelectedLayerId(layer.id)} style={wrapperStyle} className="border-0 bg-transparent p-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: layer.fit }} />
                    </button>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Layers</p>
          <div className="space-y-2">
            {[...sortedLayers].reverse().map(layer => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setSelectedLayerId(layer.id)}
                className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-xs ${selectedLayerId === layer.id ? 'border-blue-400/50 bg-blue-400/10 text-blue-100' : 'border-white/5 bg-white/[0.02] text-slate-400'}`}
              >
                <span className="truncate">{layer.visible ? '◉' : '○'} {layer.name}</span>
                <span className="text-[9px] uppercase text-slate-600">{layer.type}</span>
              </button>
            ))}
            {sortedLayers.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">Add a paint layer to begin.</p>
            )}
          </div>

          {selectedLayer && (
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <input value={selectedLayer.name} onChange={event => patchSelectedLayer({ name: event.target.value })} className="min-h-10 w-full rounded border border-white/10 bg-black/20 px-3 text-sm text-white" />
              <label className="block text-[10px] uppercase text-slate-500">Layer opacity {Math.round(selectedLayer.opacity * 100)}%
                <input type="range" min={0} max={1} step={0.05} value={selectedLayer.opacity} onChange={event => patchSelectedLayer({ opacity: Number(event.target.value) })} className="mt-1 w-full" />
              </label>
              <select value={selectedLayer.blendMode} onChange={event => patchSelectedLayer({ blendMode: event.target.value as PhoenixMediaLayer['blendMode'] })} className="min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-white">
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" onClick={() => patchSelectedLayer({ visible: !selectedLayer.visible })}>{selectedLayer.visible ? 'Hide' : 'Show'}</Button>
                <Button size="sm" variant="ghost" onClick={() => patchSelectedLayer({ locked: !selectedLayer.locked })}>{selectedLayer.locked ? 'Unlock' : 'Lock'}</Button>
              </div>
              <Button className="w-full" size="sm" variant="danger" onClick={deleteSelectedLayer}>Delete Layer</Button>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-violet-400/15 bg-violet-400/[0.04] p-3">
            <div className="text-xs font-bold text-violet-200">Illustration foundation</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Pressure-aware raster painting, brush presets, smoothing, symmetry, adjustable one-point/two-point perspective guides,
              persistent vector ink layers, reference layers, undo/redo, autosave, and PNG export are active. Brush texture engines, pose tools, and advanced color assistance are next.
            </p>
          </div>
        </aside>
      </div>
    </Navigation>
  );
}
