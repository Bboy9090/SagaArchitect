'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { MediaViewportToolbar } from '@/components/media/MediaViewportToolbar';
import { MediaRulers } from '@/components/media/MediaRulers';
import { LayerTransformControls } from '@/components/media/LayerTransformControls';
import { useMediaViewport } from '@/hooks/use-media-viewport';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbDeleteComicPage, dbGetAssets, dbGetComicPages, dbGetProject, dbSaveMediaDocument, type ProjectAsset } from '@/lib/db-client';
import {
  createPhoenixMediaDocument,
  listPhoenixMediaDocuments,
  mediaDocumentStorageKey,
  nextLayerZIndex,
  savePhoenixMediaDocument,
  vectorPathSvgD,
  type PhoenixMediaDocument,
  type PhoenixMediaDocumentKind,
  type PhoenixMediaLayer,
} from '@/lib/media-composition';
import {
  commitDocumentHistory,
  createDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory,
  type PhoenixDocumentHistory,
} from '@/lib/media-history';
import {
  downloadMediaBlob,
  exportPhoenixMediaDocument,
  type PhoenixRasterExportFormat,
} from '@/lib/media-renderer';
import type { Universe } from '@/lib/types';

interface ComicStudioPageProps {
  params: Promise<{ id: string }>;
}

interface ComicTemplate {
  id: string;
  label: string;
  panels: Array<{ x: number; y: number; width: number; height: number }>;
}

const PAGE_WIDTH = 1650;
const PAGE_HEIGHT = 2550;

const COMIC_LETTERING_STYLES = [
  { id: 'dialogue', label: 'Dialogue', fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 44, italic: false, letterSpacing: 0, lineHeight: 1.05 },
  { id: 'caption', label: 'Caption', fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: 50, italic: false, letterSpacing: 1.5, lineHeight: 1.08 },
  { id: 'whisper', label: 'Whisper', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 40, italic: true, letterSpacing: 0.5, lineHeight: 1.12 },
  { id: 'shout', label: 'Shout', fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontSize: 56, italic: false, letterSpacing: 1, lineHeight: 1 },
] as const;
const TEMPLATES: ComicTemplate[] = [
  { id: 'single', label: '1 Panel', panels: [{ x: 90, y: 90, width: 1470, height: 2370 }] },
  { id: 'two-row', label: '2 Rows', panels: [
    { x: 90, y: 90, width: 1470, height: 1155 },
    { x: 90, y: 1293, width: 1470, height: 1167 },
  ] },
  { id: 'three-stack', label: '3 Stack', panels: [
    { x: 90, y: 90, width: 1470, height: 742 },
    { x: 90, y: 880, width: 1470, height: 742 },
    { x: 90, y: 1670, width: 1470, height: 790 },
  ] },
  { id: 'four-grid', label: '4 Grid', panels: [
    { x: 90, y: 90, width: 711, height: 1155 },
    { x: 849, y: 90, width: 711, height: 1155 },
    { x: 90, y: 1293, width: 711, height: 1167 },
    { x: 849, y: 1293, width: 711, height: 1167 },
  ] },
  { id: 'six-grid', label: '6 Grid', panels: [
    { x: 90, y: 90, width: 711, height: 742 },
    { x: 849, y: 90, width: 711, height: 742 },
    { x: 90, y: 880, width: 711, height: 742 },
    { x: 849, y: 880, width: 711, height: 742 },
    { x: 90, y: 1670, width: 711, height: 790 },
    { x: 849, y: 1670, width: 711, height: 790 },
  ] },
];

function isPanelLayer(layer: PhoenixMediaLayer | null): boolean {
  return Boolean(layer?.type === 'shape' && layer.name.startsWith('Panel '));
}

export default function ComicStudioPage({ params }: ComicStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [history, setHistory] = useState<PhoenixDocumentHistory | null>(null);
  const [pages, setPages] = useState<PhoenixMediaDocument[]>([]);
  const [activePageKind, setActivePageKind] = useState<PhoenixMediaDocumentKind>('comic_page');
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<PhoenixRasterExportFormat | null>(null);
  const [exportError, setExportError] = useState('');
  const {
    zoom,
    setZoom,
    showGuides,
    setShowGuides,
    snap,
    setSnap,
    showRulers,
    setShowRulers,
    snapValue,
    fitToView,
    scrollRef,
    panHandlers,
  } = useMediaViewport(0.28);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        const localPages = listPhoenixMediaDocuments(id, 'comic_page');
        const cloudPages = isDbMode() ? await dbGetComicPages(id) : [];
        const loadedPages = (cloudPages.length > 0 ? cloudPages : localPages)
          .sort((a, b) => (a.pageOrder ?? Number.MAX_SAFE_INTEGER) - (b.pageOrder ?? Number.MAX_SAFE_INTEGER)
            || a.createdAt.localeCompare(b.createdAt));
        const firstPage = loadedPages[0] || {
          ...createPhoenixMediaDocument(id, 'comic_page'),
          title: 'Comic Page 1',
          pageOrder: 0,
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          background: '#ffffff',
        };
        const normalizedPages = loadedPages.length > 0 ? loadedPages : [firstPage];
        if (cancelled) return;
        setProject(loadedProject);
        setPages(normalizedPages);
        setActivePageKind(firstPage.kind);
        setHistory(createDocumentHistory(firstPage));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const document = history?.present || null;
  const sortedLayers = useMemo(
    () => [...(document?.layers || [])].sort((a, b) => a.zIndex - b.zIndex),
    [document?.layers],
  );
  const selectedLayer = document?.layers.find(layer => layer.id === selectedLayerId) || null;

  useEffect(() => {
    if (!document || loading) return;
    const handle = window.setTimeout(() => {
      const saved = savePhoenixMediaDocument(document);
      setPages(current => current
        .map(page => page.kind === saved.kind ? saved : page)
        .sort((a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0)));
      if (isDbMode()) {
        void dbSaveMediaDocument(id, saved)
          .then(cloudSaved => {
            setPages(current => current.map(page => page.kind === cloudSaved.kind ? cloudSaved : page));
          })
          .catch(error => console.error('Phoenix cloud media autosave failed:', error));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [document, id, loading]);

  const commit = (updater: (current: PhoenixMediaDocument) => PhoenixMediaDocument) => {
    setHistory(current => current ? commitDocumentHistory(current, updater(current.present)) : current);
  };

  const patchSelected = (patch: Partial<PhoenixMediaLayer>) => {
    if (!selectedLayer) return;
    commit(current => {
      const nextTransform = patch.transform;
      const balloonGroup = selectedLayer.groupId?.startsWith('balloon:') ? selectedLayer.groupId : null;
      const dx = nextTransform ? nextTransform.x - selectedLayer.transform.x : 0;
      const dy = nextTransform ? nextTransform.y - selectedLayer.transform.y : 0;
      return {
        ...current,
        layers: current.layers.map(layer => {
          if (layer.id === selectedLayer.id) return { ...layer, ...patch } as PhoenixMediaLayer;
          if (balloonGroup && nextTransform && layer.groupId === balloonGroup) {
            return {
              ...layer,
              transform: {
                ...layer.transform,
                x: layer.transform.x + dx,
                y: layer.transform.y + dy,
              },
            } as PhoenixMediaLayer;
          }
          return layer;
        }),
      };
    });
  };

  const applyLetteringStyle = (styleId: string) => {
    if (!selectedLayer || selectedLayer.type !== 'text') return;
    const style = COMIC_LETTERING_STYLES.find(candidate => candidate.id === styleId);
    if (!style) return;
    patchSelected({
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      italic: style.italic,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
    } as Partial<PhoenixMediaLayer>);
  };

  const persistPageOrder = (orderedPages: PhoenixMediaDocument[]) => {
    const normalized = orderedPages.map((page, index) => ({ ...page, pageOrder: index }));
    setPages(normalized);
    for (const page of normalized) {
      const saved = savePhoenixMediaDocument(page);
      if (isDbMode()) {
        void dbSaveMediaDocument(id, saved)
          .catch(error => console.error('Comic page order save failed:', error));
      }
    }
  };

  const openPage = (kind: PhoenixMediaDocumentKind) => {
    if (document) {
      setPages(current => current.map(page => page.kind === document.kind ? document : page));
    }
    const target = pages.find(page => page.kind === kind);
    if (!target) return;
    setActivePageKind(kind);
    setSelectedLayerId('');
    setHistory(createDocumentHistory(target));
  };

  const addPage = () => {
    const kind = `comic_page:${crypto.randomUUID()}` as PhoenixMediaDocumentKind;
    const page = {
      ...createPhoenixMediaDocument(id, kind),
      title: `Comic Page ${pages.length + 1}`,
      pageOrder: pages.length,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      background: '#ffffff',
    };
    const next = [...pages.map(existing => existing.kind === document?.kind ? document : existing), page];
    setPages(next);
    setActivePageKind(kind);
    setSelectedLayerId('');
    setHistory(createDocumentHistory(page));
    const saved = savePhoenixMediaDocument(page);
    if (isDbMode()) void dbSaveMediaDocument(id, saved).catch(error => console.error('Comic page create failed:', error));
  };

  const duplicatePage = () => {
    if (!document) return;
    const kind = `comic_page:${crypto.randomUUID()}` as PhoenixMediaDocumentKind;
    const now = new Date().toISOString();
    const page: PhoenixMediaDocument = {
      ...structuredClone(document),
      id: crypto.randomUUID(),
      kind,
      title: `${document.title} Copy`,
      pageOrder: pages.length,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...pages.map(existing => existing.kind === document.kind ? document : existing), page];
    setPages(next);
    setActivePageKind(kind);
    setSelectedLayerId('');
    setHistory(createDocumentHistory(page));
    const saved = savePhoenixMediaDocument(page);
    if (isDbMode()) void dbSaveMediaDocument(id, saved).catch(error => console.error('Comic page duplicate failed:', error));
  };

  const movePage = (direction: -1 | 1) => {
    const index = pages.findIndex(page => page.kind === activePageKind);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    persistPageOrder(next);
  };

  const deletePage = () => {
    if (!document || pages.length <= 1) return;
    const index = pages.findIndex(page => page.kind === document.kind);
    const next = pages.filter(page => page.kind !== document.kind);
    window.localStorage.removeItem(mediaDocumentStorageKey(id, document.kind));
    if (isDbMode()) void dbDeleteComicPage(id, document.kind).catch(error => console.error('Comic page delete failed:', error));
    const normalized = next.map((page, pageIndex) => ({ ...page, pageOrder: pageIndex }));
    setPages(normalized);
    const fallback = normalized[Math.min(index, normalized.length - 1)];
    setActivePageKind(fallback.kind);
    setSelectedLayerId('');
    setHistory(createDocumentHistory(fallback));
    persistPageOrder(normalized);
  };

  const applyTemplate = (template: ComicTemplate) => {
    if (!document) return;
    const retained = document.layers.filter(layer => !isPanelLayer(layer));
    const panels: PhoenixMediaLayer[] = template.panels.map((panel, index) => ({
      id: crypto.randomUUID(),
      type: 'shape',
      name: `Panel ${index + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: index + 1,
      transform: { ...panel, rotation: 0 },
      shape: 'rectangle',
      fill: '#f8fafc',
      stroke: '#111827',
      strokeWidth: 12,
    }));
    commit(current => ({
      ...current,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      background: '#ffffff',
      layers: [...panels, ...retained.map((layer, index) => ({ ...layer, zIndex: panels.length + index + 1 }))],
    }));
    setSelectedLayerId(panels[0]?.id || '');
  };

  const addCaption = () => {
    if (!document) return;
    const layer: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      name: 'Caption',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 150, y: 150, width: 720, height: 150, rotation: 0 },
      text: 'CAPTION',
      color: '#111827',
      fontSize: 54,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 800,
      align: 'left',
    };
    commit(current => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedLayerId(layer.id);
  };

  const addSpeechBalloon = () => {
    if (!document) return;
    const z = nextLayerZIndex(document.layers);
    const groupId = `balloon:${crypto.randomUUID()}`;
    const balloon: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'shape',
      groupId,
      name: 'Speech Balloon',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: z,
      transform: { x: 240, y: 240, width: 560, height: 280, rotation: 0 },
      shape: 'ellipse',
      fill: '#ffffff',
      stroke: '#111827',
      strokeWidth: 10,
    };
    const tail: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'path',
      groupId,
      name: 'Balloon Tail',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: z + 1,
      transform: { x: 520, y: 455, width: 140, height: 150, rotation: -8 },
      points: [
        { x: 0, y: 0 },
        { x: 110, y: 0 },
        { x: 70, y: 145 },
      ],
      closed: true,
      fill: '#ffffff',
      stroke: '#111827',
      strokeWidth: 10,
    };
    const text: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      groupId,
      name: 'Balloon Text',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: z + 2,
      transform: { x: 310, y: 300, width: 420, height: 160, rotation: 0 },
      text: 'Dialogue goes here.',
      color: '#111827',
      fontSize: 44,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 700,
      align: 'center',
      lineHeight: 1.05,
      letterSpacing: 0,
    };
    commit(current => ({
      ...current,
      groups: [...(current.groups || []), {
        id: groupId,
        name: 'Speech Balloon',
        visible: true,
        locked: false,
        opacity: 1,
      }],
      layers: [...current.layers, balloon, tail, text],
    }));
    setSelectedLayerId(text.id);
  };

  const placeAssetInPanel = (asset: ProjectAsset) => {
    if (!document || !selectedLayer || !isPanelLayer(selectedLayer)) return;
    const panel = selectedLayer.transform;
    const image: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'image',
      name: `${selectedLayer.name} Art`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { ...panel },
      assetId: asset.id,
      src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
      fit: 'cover',
      mask: { x: 0, y: 0, width: panel.width, height: panel.height },
    };
    commit(current => ({ ...current, layers: [...current.layers, image] }));
    setSelectedLayerId(image.id);
  };

  const exportFlattened = async (format: PhoenixRasterExportFormat) => {
    if (!document || exportingFormat) return;
    setExportingFormat(format);
    setExportError('');
    try {
      const blob = await exportPhoenixMediaDocument(document, format);
      downloadMediaBlob(blob, document.title, format);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Comic export failed.');
    } finally {
      setExportingFormat(null);
    }
  };

  if (loading || !document || !history) {
    return <Navigation><div className="flex min-h-[60vh] items-center justify-center"><Spinner text="Opening Comic Studio..." /></div></Navigation>;
  }

  return (
    <Navigation>
      <Header
        title="Comic Studio"
        subtitle={`Panel layout and lettering for ${project?.name || 'Phoenix project'} • Page ${Math.max(1, pages.findIndex(page => page.kind === activePageKind) + 1)} of ${Math.max(1, pages.length)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={history.past.length === 0} onClick={() => setHistory(current => current ? undoDocumentHistory(current) : current)}>Undo</Button>
            <Button size="sm" variant="ghost" disabled={history.future.length === 0} onClick={() => setHistory(current => current ? redoDocumentHistory(current) : current)}>Redo</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'png'} onClick={() => void exportFlattened('png')}>PNG</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'jpeg'} onClick={() => void exportFlattened('jpeg')}>JPEG</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'webp'} onClick={() => void exportFlattened('webp')}>WebP</Button>
          </div>
        }
      />

      {exportError && <div className="mx-4 mt-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{exportError}</div>}

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Issue Pages</p>
          <div className="mb-5 space-y-2">
            {pages.map((page, index) => (
              <button
                key={page.kind}
                type="button"
                onClick={() => openPage(page.kind)}
                className={`flex min-h-10 w-full items-center justify-between rounded-lg border px-3 text-left text-xs ${page.kind === activePageKind ? 'border-blue-400/50 bg-blue-400/10 text-blue-100' : 'border-white/5 text-slate-400 hover:border-blue-400/30'}`}
              >
                <span className="truncate">{page.title || `Comic Page ${index + 1}`}</span>
                <span className="text-[10px] text-slate-500">{index + 1}</span>
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={addPage}>+ Page</Button>
              <Button size="sm" variant="secondary" onClick={duplicatePage}>Duplicate</Button>
              <Button size="sm" variant="ghost" disabled={pages.findIndex(page => page.kind === activePageKind) <= 0} onClick={() => movePage(-1)}>Move Up</Button>
              <Button size="sm" variant="ghost" disabled={pages.findIndex(page => page.kind === activePageKind) >= pages.length - 1} onClick={() => movePage(1)}>Move Down</Button>
            </div>
            <Button size="sm" variant="danger" className="w-full" disabled={pages.length <= 1} onClick={deletePage}>Delete Page</Button>
          </div>

          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Page Templates</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(template => (
              <button key={template.id} type="button" onClick={() => applyTemplate(template)} className="min-h-16 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-left hover:border-blue-400/40">
                <div className="text-xs font-bold text-white">{template.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">{template.panels.length} panel{template.panels.length === 1 ? '' : 's'}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2">
            <Button size="sm" variant="secondary" onClick={addSpeechBalloon}>+ Speech Balloon</Button>
            <Button size="sm" variant="secondary" onClick={addCaption}>+ Caption</Button>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Panel Art</p>
            {!isPanelLayer(selectedLayer) && <p className="mb-3 text-xs leading-5 text-slate-500">Select a panel frame, then choose an image to place it inside that panel.</p>}
            <div className="grid grid-cols-2 gap-2">
              {assets.filter(asset => asset.mime_type.startsWith('image/')).map(asset => (
                <button key={asset.id} type="button" disabled={!isPanelLayer(selectedLayer)} onClick={() => placeAssetInPanel(asset)} className="overflow-hidden rounded-lg border border-white/10 disabled:opacity-30 hover:border-blue-400/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.serve_url || `/api/db/assets/${asset.id}/serve`} alt="" className="aspect-square w-full object-cover" />
                  <span className="block truncate px-2 py-1 text-[10px] text-slate-400">{asset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-[#04060b] p-4">
          <MediaViewportToolbar
            zoom={zoom}
            onZoomChange={setZoom}
            onFit={() => fitToView(document.width, document.height)}
            showGuides={showGuides}
            onToggleGuides={() => setShowGuides(value => !value)}
            snap={snap}
            onToggleSnap={() => setSnap(value => !value)}
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers(value => !value)}
          />
          <div ref={scrollRef} {...panHandlers} className="relative mt-4 min-h-[720px] flex-1 cursor-grab overflow-auto rounded-lg border border-white/5 bg-[#03050a] p-10 active:cursor-grabbing">
            <div className="relative mx-auto w-max pt-6 pl-6">
              <MediaRulers width={document.width} height={document.height} zoom={zoom} visible={showRulers} />
              <div className="relative overflow-hidden bg-white shadow-2xl" style={{ width: document.width * zoom, height: document.height * zoom, background: document.background }}>
                {showGuides && (
                  <>
                    <div className="pointer-events-none absolute inset-[4%] z-[9998] border border-dashed border-cyan-300/40" />
                    <div className="pointer-events-none absolute left-1/2 top-0 z-[9998] h-full border-l border-dashed border-black/20" />
                    <div className="pointer-events-none absolute left-0 top-1/2 z-[9998] w-full border-t border-dashed border-black/20" />
                  </>
                )}

                {sortedLayers.map(layer => {
                  if (!layer.visible) return null;
                  const mask = layer.mask;
                  const clipPath = mask ? `inset(${(mask.y / layer.transform.height) * 100}% ${((layer.transform.width - mask.x - mask.width) / layer.transform.width) * 100}% ${((layer.transform.height - mask.y - mask.height) / layer.transform.height) * 100}% ${(mask.x / layer.transform.width) * 100}%)` : undefined;
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    left: layer.transform.x * zoom,
                    top: layer.transform.y * zoom,
                    width: layer.transform.width * zoom,
                    height: layer.transform.height * zoom,
                    opacity: layer.opacity,
                    transform: `rotate(${layer.transform.rotation}deg)`,
                    transformOrigin: 'center',
                    clipPath,
                  };
                  return (
                    <button key={layer.id} type="button" data-media-interactive="true" onClick={() => setSelectedLayerId(layer.id)} className="block border-0 bg-transparent p-0 text-left" style={style}>
                      {layer.type === 'shape' && <div className="h-full w-full" style={{ background: layer.fill, border: layer.strokeWidth ? `${Math.max(1, layer.strokeWidth * zoom)}px solid ${layer.stroke}` : undefined, borderRadius: layer.shape === 'ellipse' ? '9999px' : 0 }} />}
                      {layer.type === 'text' && <div className="h-full w-full overflow-hidden" style={{ color: layer.color, fontSize: layer.fontSize * zoom, fontFamily: layer.fontFamily, fontWeight: layer.fontWeight, lineHeight: 1.05, textAlign: layer.align }}>{layer.text}</div>}
                      {layer.type === 'path' && (
                        <svg viewBox={`0 0 ${layer.transform.width} ${layer.transform.height}`} className="h-full w-full overflow-visible">
                          <path
                            d={vectorPathSvgD(layer)}
                            fill={layer.fill}
                            stroke={layer.stroke}
                            strokeWidth={layer.strokeWidth}
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {layer.type === 'image' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: layer.fit }} />
                      )}
                      {layer.type === 'raster' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={layer.src} alt="" className="h-full w-full" />
                      )}
                    </button>
                  );
                })}

                {selectedLayer && selectedLayer.visible && (
                  <LayerTransformControls
                    transform={selectedLayer.transform}
                    zoom={zoom}
                    canvasWidth={document.width}
                    canvasHeight={document.height}
                    locked={selectedLayer.locked}
                    allowMove={selectedLayer.type !== 'raster'}
                    snapValue={snapValue}
                    onCommit={transform => patchSelected({ transform } as Partial<PhoenixMediaLayer>)}
                  />
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Layers</p>
          <div className="space-y-2">
            {[...sortedLayers].reverse().map(layer => (
              <button key={layer.id} type="button" onClick={() => setSelectedLayerId(layer.id)} className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-xs ${selectedLayerId === layer.id ? 'border-blue-400/50 bg-blue-400/10 text-blue-100' : 'border-white/5 text-slate-400'}`}>
                <span className="truncate">{layer.name}</span><span className="text-[9px] uppercase">{layer.type}</span>
              </button>
            ))}
          </div>

          {selectedLayer && (
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <label className="block text-[10px] uppercase text-slate-500">Name
                <input value={selectedLayer.name} onChange={event => patchSelected({ name: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-black/20 px-2 text-white" />
              </label>
              {selectedLayer.type === 'text' && (
                <>
                  <label className="block text-[10px] uppercase text-slate-500">Text
                    <textarea value={selectedLayer.text} onChange={event => patchSelected({ text: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 min-h-24 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                  </label>
                  <div>
                    <div className="mb-2 text-[10px] uppercase text-slate-500">Lettering Style</div>
                    <div className="grid grid-cols-2 gap-2">
                      {COMIC_LETTERING_STYLES.map(style => (
                        <Button key={style.id} size="sm" variant="ghost" onClick={() => applyLetteringStyle(style.id)}>
                          {style.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Button size="sm" variant="ghost" className="w-full" onClick={() => patchSelected({ locked: !selectedLayer.locked })}>{selectedLayer.locked ? 'Unlock Layer' : 'Lock Layer'}</Button>
              <Button size="sm" variant="danger" className="w-full" onClick={() => {
                commit(current => ({ ...current, layers: current.layers.filter(layer => layer.id !== selectedLayer.id) }));
                setSelectedLayerId('');
              }}>Delete Layer</Button>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
            <div className="text-xs font-bold text-amber-200">Comic foundation</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Multi-page issues, page duplication/reordering, page templates, panel frames, image placement, grouped speech balloons with vector tails, lettering presets, direct transforms, and raster export are active.
              Linked panel groups, advanced balloon geometry, issue-level export, and motion-comic handoff are next.
            </p>
          </div>
        </aside>
      </div>
    </Navigation>
  );
}
