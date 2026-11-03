'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetAssets, dbGetProject, type ProjectAsset } from '@/lib/db-client';
import {
  createPhoenixMediaDocument,
  loadPhoenixMediaDocument,
  nextLayerZIndex,
  savePhoenixMediaDocument,
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

interface DesignStudioPageProps {
  params: Promise<{ id: string }>;
}

const PRESETS = [
  { id: 'square', label: 'Square Post', width: 1080, height: 1080 },
  { id: 'story', label: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'thumbnail', label: 'Video Thumbnail', width: 1280, height: 720 },
  { id: 'poster', label: 'Poster', width: 1800, height: 2400 },
  { id: 'book-cover', label: 'Book Cover', width: 1600, height: 2560 },
  { id: 'comic-page', label: 'Comic Page', width: 1650, height: 2550 },
] as const;

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char] || char));
}

function buildSvg(document: PhoenixMediaDocument): string {
  const layers = [...document.layers].filter(layer => layer.visible).sort((a, b) => a.zIndex - b.zIndex);
  const body = layers.map(layer => {
    const { x, y, width, height, rotation } = layer.transform;
    const transform = `rotate(${rotation} ${x + width / 2} ${y + height / 2})`;
    const opacity = Math.max(0, Math.min(1, layer.opacity));

    if (layer.type === 'shape') {
      if (layer.shape === 'ellipse') {
        return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}" />`;
      }
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}" />`;
    }

    if (layer.type === 'text') {
      const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
      const tx = layer.align === 'center' ? x + width / 2 : layer.align === 'right' ? x + width : x;
      return `<text x="${tx}" y="${y + layer.fontSize}" fill="${layer.color}" font-size="${layer.fontSize}" font-family="${escapeXml(layer.fontFamily)}" font-weight="${layer.fontWeight}" text-anchor="${anchor}" opacity="${opacity}" transform="${transform}">${escapeXml(layer.text)}</text>`;
    }

    return `<image href="${escapeXml(layer.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${layer.fit === 'contain' ? 'xMidYMid meet' : layer.fit === 'cover' ? 'xMidYMid slice' : 'none'}" opacity="${opacity}" transform="${transform}" />`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}"><rect width="100%" height="100%" fill="${document.background}"/>${body}</svg>`;
}

export default function DesignStudioPage({ params }: DesignStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [history, setHistory] = useState<PhoenixDocumentHistory | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.32);
  const [showGuides, setShowGuides] = useState(true);
  const [snap, setSnap] = useState(true);

  const document = history?.present || null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        const loadedDocument = loadPhoenixMediaDocument(id, 'design') || createPhoenixMediaDocument(id, 'design');
        if (cancelled) return;
        setProject(loadedProject);
        setHistory(createDocumentHistory(loadedDocument));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!document || loading) return;
    const handle = window.setTimeout(() => savePhoenixMediaDocument(document), 250);
    return () => window.clearTimeout(handle);
  }, [document, loading]);

  const sortedLayers = useMemo(
    () => [...(document?.layers || [])].sort((a, b) => a.zIndex - b.zIndex),
    [document?.layers],
  );
  const selected = document?.layers.find(layer => layer.id === selectedLayerId) || null;

  const commit = (updater: (current: PhoenixMediaDocument) => PhoenixMediaDocument) => {
    setHistory(current => {
      if (!current) return current;
      return commitDocumentHistory(current, updater(current.present));
    });
  };

  const quantize = (value: number) => snap ? Math.round(value / 10) * 10 : value;

  const applyPreset = (width: number, height: number, title: string) => {
    commit(current => ({ ...current, width, height, title }));
    setZoom(Math.min(0.45, 720 / width, 720 / height));
  };

  const addText = () => {
    if (!document) return;
    const layer: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      name: 'Headline',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 120, y: 120, width: Math.max(320, document.width - 240), height: 180, rotation: 0 },
      text: 'Your headline',
      color: '#ffffff',
      fontSize: Math.max(48, Math.round(document.width * 0.06)),
      fontFamily: 'Arial, sans-serif',
      fontWeight: 800,
      align: 'left',
    };
    commit(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layer.id);
  };

  const addShape = () => {
    if (!document) return;
    const layer: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'shape',
      name: 'Shape',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 160, y: 260, width: Math.round(document.width * 0.4), height: Math.round(document.height * 0.18), rotation: 0 },
      shape: 'rectangle',
      fill: '#2563eb',
      stroke: '#60a5fa',
      strokeWidth: 0,
    };
    commit(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layer.id);
  };

  const addImage = (asset: ProjectAsset) => {
    if (!document) return;
    const layer: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'image',
      name: asset.name,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 100, y: 100, width: Math.round(document.width * 0.55), height: Math.round(document.height * 0.55), rotation: 0 },
      assetId: asset.id,
      src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
      fit: 'cover',
    };
    commit(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layer.id);
  };

  const patchLayer = (patch: Partial<PhoenixMediaLayer>) => {
    if (!selected) return;
    commit(current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === selected.id ? ({ ...layer, ...patch } as PhoenixMediaLayer) : layer),
    }));
  };

  const patchTransform = (key: keyof PhoenixMediaLayer['transform'], value: number) => {
    if (!selected) return;
    const next = { ...selected.transform, [key]: quantize(value) };
    patchLayer({ transform: next } as Partial<PhoenixMediaLayer>);
  };

  const exportSvg = () => {
    if (!document) return;
    const blob = new Blob([buildSvg(document)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${document.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phoenix-design'}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !document || !history) {
    return <Navigation><div className="flex min-h-[60vh] items-center justify-center"><Spinner text="Opening Design Studio..." /></div></Navigation>;
  }

  return (
    <Navigation>
      <Header
        title="Design Studio"
        subtitle={`Covers, posters, thumbnails, pages, and social graphics for ${project?.name || 'Phoenix production'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" disabled={history.past.length === 0} onClick={() => setHistory(current => current ? undoDocumentHistory(current) : current)}>Undo</Button>
            <Button size="sm" variant="ghost" disabled={history.future.length === 0} onClick={() => setHistory(current => current ? redoDocumentHistory(current) : current)}>Redo</Button>
            <Button size="sm" variant="gold" onClick={exportSvg}>Export SVG</Button>
          </div>
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map(preset => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset.width, preset.height, preset.label)}
                className="min-h-16 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-left hover:border-blue-400/40">
                <div className="text-xs font-bold text-white">{preset.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">{preset.width} × {preset.height}</div>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Add</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={addText}>Text</Button>
              <Button size="sm" variant="secondary" onClick={addShape}>Shape</Button>
            </div>
          </div>

          {isDbMode() && assets.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Assets</p>
              <div className="grid grid-cols-2 gap-2">
                {assets.filter(asset => asset.mime_type.startsWith('image/')).map(asset => (
                  <button key={asset.id} type="button" onClick={() => addImage(asset)} className="overflow-hidden rounded-lg border border-white/10 hover:border-blue-400/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.serve_url || `/api/db/assets/${asset.id}/serve`} alt="" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-2 py-1 text-[10px] text-slate-400">{asset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="overflow-auto bg-[#04060b] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#090d17] px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{document.width} × {document.height}</span>
              <span>•</span>
              <button onClick={() => setShowGuides(value => !value)} className="rounded px-2 py-1 hover:bg-white/5">{showGuides ? 'Guides on' : 'Guides off'}</button>
              <button onClick={() => setSnap(value => !value)} className="rounded px-2 py-1 hover:bg-white/5">{snap ? 'Snap 10px' : 'Snap off'}</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(value => Math.max(0.1, value - 0.05))} className="h-9 w-9 rounded border border-white/10 text-white">−</button>
              <span className="w-14 text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(value => Math.min(1, value + 0.05))} className="h-9 w-9 rounded border border-white/10 text-white">+</button>
            </div>
          </div>

          <div className="flex min-h-[680px] items-start justify-center overflow-auto p-8">
            <div
              className="relative shrink-0 overflow-hidden bg-white shadow-2xl"
              style={{ width: document.width * zoom, height: document.height * zoom, background: document.background }}
              aria-label="Design composition canvas"
            >
              {showGuides && (
                <>
                  <div className="pointer-events-none absolute inset-[5%] z-[9999] border border-dashed border-cyan-300/50" />
                  <div className="pointer-events-none absolute inset-[10%] z-[9999] border border-dashed border-fuchsia-300/40" />
                  <div className="pointer-events-none absolute left-1/2 top-0 z-[9999] h-full border-l border-dashed border-white/20" />
                  <div className="pointer-events-none absolute left-0 top-1/2 z-[9999] w-full border-t border-dashed border-white/20" />
                </>
              )}

              {sortedLayers.map(layer => {
                if (!layer.visible) return null;
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: layer.transform.x * zoom,
                  top: layer.transform.y * zoom,
                  width: layer.transform.width * zoom,
                  height: layer.transform.height * zoom,
                  opacity: layer.opacity,
                  transform: `rotate(${layer.transform.rotation}deg)`,
                  transformOrigin: 'center',
                  outline: selectedLayerId === layer.id ? '2px solid #38bdf8' : undefined,
                  outlineOffset: 2,
                };
                return (
                  <button key={layer.id} type="button" onClick={() => setSelectedLayerId(layer.id)} style={style} className="block border-0 bg-transparent p-0 text-left">
                    {layer.type === 'shape' && <div className="h-full w-full" style={{ background: layer.fill, border: layer.strokeWidth ? `${Math.max(1, layer.strokeWidth * zoom)}px solid ${layer.stroke}` : undefined }} />}
                    {layer.type === 'text' && <div className="h-full w-full overflow-hidden" style={{ color: layer.color, fontSize: layer.fontSize * zoom, fontFamily: layer.fontFamily, fontWeight: layer.fontWeight, lineHeight: 1.05, textAlign: layer.align }}>{layer.text}</div>}
                    {layer.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: layer.fit }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Layers</p>
          <div className="space-y-2">
            {[...sortedLayers].reverse().map(layer => (
              <button key={layer.id} type="button" onClick={() => setSelectedLayerId(layer.id)}
                className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-xs ${selectedLayerId === layer.id ? 'border-blue-400/50 bg-blue-400/10 text-blue-100' : 'border-white/5 text-slate-400'}`}>
                <span className="truncate">{layer.name}</span><span className="text-[9px] uppercase">{layer.type}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <label className="block text-[10px] uppercase text-slate-500">Name
                <input value={selected.name} onChange={event => patchLayer({ name: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-black/20 px-2 text-white" />
              </label>
              {selected.type === 'text' && (
                <>
                  <label className="block text-[10px] uppercase text-slate-500">Text
                    <textarea value={selected.text} onChange={event => patchLayer({ text: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 min-h-20 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                  </label>
                  <label className="block text-[10px] uppercase text-slate-500">Color
                    <input type="color" value={selected.color} onChange={event => patchLayer({ color: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full" />
                  </label>
                </>
              )}
              {selected.type === 'shape' && (
                <label className="block text-[10px] uppercase text-slate-500">Fill
                  <input type="color" value={selected.fill} onChange={event => patchLayer({ fill: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full" />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map(key => (
                  <label key={key} className="text-[10px] uppercase text-slate-500">{key}
                    <input type="number" value={Math.round(selected.transform[key])} onChange={event => patchTransform(key, Number(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                  </label>
                ))}
              </div>
              <Button size="sm" variant="danger" className="w-full" onClick={() => {
                commit(current => ({ ...current, layers: current.layers.filter(layer => layer.id !== selected.id) }));
                setSelectedLayerId('');
              }}>Delete Layer</Button>
            </div>
          )}
        </aside>
      </div>
    </Navigation>
  );
}
