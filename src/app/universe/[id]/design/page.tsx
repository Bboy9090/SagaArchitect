'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { MediaViewportToolbar } from '@/components/media/MediaViewportToolbar';
import { MediaRulers } from '@/components/media/MediaRulers';
import { LayerTransformControls } from '@/components/media/LayerTransformControls';
import { LayerGroupPanel } from '@/components/media/LayerGroupPanel';
import { CompoundContourPanel } from '@/components/media/CompoundContourPanel';
import { SymbolPanel } from '@/components/media/SymbolPanel';
import { VectorMaskPanel } from '@/components/media/VectorMaskPanel';
import { LayerShadowPanel } from '@/components/media/LayerShadowPanel';
import { MediaDocumentIO } from '@/components/media/MediaDocumentIO';
import { LayerAlignmentPanel } from '@/components/media/LayerAlignmentPanel';
import { AdjustmentLayerPanel } from '@/components/media/AdjustmentLayerPanel';
import { MultiLayerLayoutPanel } from '@/components/media/MultiLayerLayoutPanel';
import { useMediaViewport } from '@/hooks/use-media-viewport';
import { useMediaEditorShortcuts } from '@/hooks/use-media-editor-shortcuts';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetAssets, dbGetMediaDocument, dbGetProject, dbSaveMediaDocument, type ProjectAsset } from '@/lib/db-client';
import {
  alignLayerTransformsToSelection,
  clampLayerTransform,
  createAdjustmentLayer,
  createPhoenixMediaDocument,
  createSymbolInstance,
  detachSymbolInstance,
  distributeLayerTransforms,
  loadPhoenixMediaDocument,
  nextLayerZIndex,
  removeLayerPreservingSymbols,
  resolveSymbolLayer,
  savePhoenixMediaDocument,
  effectiveLayerOpacity,
  gradientFillCss,
  isLayerEffectivelyLocked,
  isLayerEffectivelyVisible,
  layerCssEffects,
  layerCssFilter,
  moveVectorPoint,
  scaleVectorContours,
  scaleVectorMask,
  scaleVectorPoints,
  textLetterSpacing,
  textLineHeight,
  vectorMaskCssClipPath,
  vectorPathFillRule,
  vectorPathFillSvgD,
  vectorPathSvgD,
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
import {
  downloadMediaBlob,
  exportPhoenixMediaDocument,
  type PhoenixRasterExportFormat,
} from '@/lib/media-renderer';
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

function cssMaskClipPath(layer: PhoenixMediaLayer): string | undefined {
  if (!layer.mask) return undefined;
  const top = Math.max(0, (layer.mask.y / layer.transform.height) * 100);
  const left = Math.max(0, (layer.mask.x / layer.transform.width) * 100);
  const right = Math.max(0, ((layer.transform.width - layer.mask.x - layer.mask.width) / layer.transform.width) * 100);
  const bottom = Math.max(0, ((layer.transform.height - layer.mask.y - layer.mask.height) / layer.transform.height) * 100);
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

function renderSvgDrawableLayer(document: PhoenixMediaDocument, rawLayer: PhoenixMediaLayer): string {
  const layer = resolveSymbolLayer(document, rawLayer);
  if (layer.type === 'adjustment') return '';

  const { x, y, width, height, rotation } = layer.transform;
  const transform = `rotate(${rotation} ${x + width / 2} ${y + height / 2})`;
  const opacity = effectiveLayerOpacity(layer, document);
  const safeLayerId = layer.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `clip-${safeLayerId}`;
  const gradientId = `gradient-${safeLayerId}`;
  const gradient = layer.type === 'shape' || layer.type === 'path' ? layer.gradient : undefined;
  const gradientDefinition = gradient
    ? gradient.kind === 'radial'
      ? `<defs><radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${gradient.start}"/><stop offset="100%" stop-color="${gradient.end}"/></radialGradient></defs>`
      : `<defs><linearGradient id="${gradientId}" x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform="rotate(${gradient.angle - 90} .5 .5)"><stop offset="0%" stop-color="${gradient.start}"/><stop offset="100%" stop-color="${gradient.end}"/></linearGradient></defs>`
    : '';
  const layerFill = gradient ? `url(#${gradientId})` : (layer.type === 'shape' || layer.type === 'path' ? layer.fill : '');
  const maskDefinition = layer.vectorMask && layer.vectorMask.points.length >= 3
    ? `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><polygon points="${layer.vectorMask.points.map(point => `${x + point.x},${y + point.y}`).join(' ')}" transform="${transform}" /></clipPath></defs>`
    : layer.mask
      ? `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${x + layer.mask.x}" y="${y + layer.mask.y}" width="${layer.mask.width}" height="${layer.mask.height}" transform="${transform}" /></clipPath></defs>`
      : '';
  const wrap = (element: string) => {
    const filtered = `<g style="filter:${escapeXml(layerCssEffects(layer))}">${element}</g>`;
    const definitions = `${gradientDefinition}${maskDefinition}`;
    return layer.mask || (layer.vectorMask && layer.vectorMask.points.length >= 3)
      ? `${definitions}<g clip-path="url(#${clipId})">${filtered}</g>`
      : `${definitions}${filtered}`;
  };

  if (layer.type === 'shape') {
    if (layer.shape === 'ellipse') {
      return wrap(`<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${layerFill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}" />`);
    }
    return wrap(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${layerFill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}" />`);
  }

  if (layer.type === 'text') {
    const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
    const tx = layer.align === 'center' ? x + width / 2 : layer.align === 'right' ? x + width : x;
    const lineHeight = textLineHeight(layer);
    const lines = layer.text.split(/\r?\n/);
    const tspans = lines.map((line, index) =>
      `<tspan x="${tx}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    ).join('');
    return wrap(`<text x="${tx}" y="${y + layer.fontSize}" fill="${layer.color}" font-size="${layer.fontSize}" font-family="${escapeXml(layer.fontFamily)}" font-weight="${layer.fontWeight}" font-style="${layer.italic ? 'italic' : 'normal'}" text-decoration="${layer.underline ? 'underline' : 'none'}" letter-spacing="${textLetterSpacing(layer)}" text-anchor="${anchor}" opacity="${opacity}" transform="${transform}" xml:space="preserve">${tspans}</text>`);
  }

  if (layer.type === 'path') {
    const fillD = escapeXml(vectorPathFillSvgD(layer));
    const strokeD = escapeXml(vectorPathSvgD(layer));
    const localTransform = `translate(${x} ${y}) rotate(${rotation} ${width / 2} ${height / 2})`;
    const fillElement = fillD
      ? `<path d="${fillD}" fill="${layerFill}" fill-rule="${vectorPathFillRule(layer)}" stroke="none" opacity="${opacity}" transform="${localTransform}" />`
      : '';
    const strokeElement = `<path d="${strokeD}" fill="none" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${localTransform}" stroke-linejoin="round" stroke-linecap="round" />`;
    return wrap(`${fillElement}${strokeElement}`);
  }

  const preserveAspectRatio = layer.type === 'image'
    ? (layer.fit === 'contain' ? 'xMidYMid meet' : layer.fit === 'cover' ? 'xMidYMid slice' : 'none')
    : 'none';
  return wrap(`<image href="${escapeXml(layer.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${preserveAspectRatio}" opacity="${opacity}" transform="${transform}" />`);
}

function adjustmentSvgClip(layer: Extract<PhoenixMediaLayer, { type: 'adjustment' }>, clipId: string): string {
  const { x, y, width, height } = layer.transform;
  if (layer.vectorMask && layer.vectorMask.points.length >= 3) {
    const points = layer.vectorMask.points.map(point => `${x + point.x},${y + point.y}`).join(' ');
    return `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><polygon points="${points}" /></clipPath>`;
  }
  if (layer.mask) {
    return `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${x + layer.mask.x}" y="${y + layer.mask.y}" width="${layer.mask.width}" height="${layer.mask.height}" /></clipPath>`;
  }
  return `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${width}" height="${height}" /></clipPath>`;
}

function buildSvg(document: PhoenixMediaDocument): string {
  const layers = [...document.layers]
    .filter(layer => isLayerEffectivelyVisible(layer, document))
    .sort((a, b) => a.zIndex - b.zIndex);

  let body = `<rect width="100%" height="100%" fill="${document.background}"/>`;

  for (const rawLayer of layers) {
    const layer = resolveSymbolLayer(document, rawLayer);
    if (layer.type !== 'adjustment') {
      body += renderSvgDrawableLayer(document, rawLayer);
      continue;
    }

    const safeId = layer.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const sourceId = `adjustment-source-${safeId}`;
    const clipId = `adjustment-clip-${safeId}`;
    const prior = body;
    const opacity = effectiveLayerOpacity(layer, document);
    body = `<defs><g id="${sourceId}">${prior}</g>${adjustmentSvgClip(layer, clipId)}</defs>`
      + `<use href="#${sourceId}"/>`
      + `<g clip-path="url(#${clipId})" opacity="${opacity}" style="filter:${escapeXml(layerCssFilter(layer))}"><use href="#${sourceId}"/></g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">${body}</svg>`;
}

export default function DesignStudioPage({ params }: DesignStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [history, setHistory] = useState<PhoenixDocumentHistory | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [additionalLayerIds, setAdditionalLayerIds] = useState<string[]>([]);

  const focusLayer = (layerId: string) => {
    setSelectedLayerId(layerId);
    setAdditionalLayerIds([]);
  };

  const [loading, setLoading] = useState(true);
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
  } = useMediaViewport(0.32);
  const [exportingFormat, setExportingFormat] = useState<PhoenixRasterExportFormat | null>(null);
  const [exportError, setExportError] = useState('');

  const document = history?.present || null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        const localDocument = loadPhoenixMediaDocument(id, 'design');
        const cloudDocument = isDbMode() ? await dbGetMediaDocument(id, 'design') : null;
        const loadedDocument = cloudDocument || localDocument || createPhoenixMediaDocument(id, 'design');
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
    const handle = window.setTimeout(() => {
      const saved = savePhoenixMediaDocument(document);
      if (isDbMode()) {
        void dbSaveMediaDocument(id, saved)
          .catch(error => console.error('Phoenix cloud media autosave failed:', error));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [document, id, loading]);

  const sortedLayers = useMemo(
    () => [...(document?.layers || [])].sort((a, b) => a.zIndex - b.zIndex),
    [document?.layers],
  );
  const selected = document?.layers.find(layer => layer.id === selectedLayerId) || null;

  const selectedLayerIds = useMemo(
    () => [selectedLayerId, ...additionalLayerIds].filter((value, index, values) => value && values.indexOf(value) === index),
    [selectedLayerId, additionalLayerIds],
  );

  const selectLayer = (layerId: string, additive = false) => {
    if (!additive || !selectedLayerId) {
      focusLayer(layerId);
      setAdditionalLayerIds([]);
      return;
    }
    if (layerId === selectedLayerId) return;
    setAdditionalLayerIds(current => current.includes(layerId)
      ? current.filter(id => id !== layerId)
      : [...current, layerId]);
  };

  const applyBatchLayout = (
    operation: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'horizontal' | 'vertical',
  ) => {
    if (!document) return;
    const movable = document.layers.filter(layer =>
      selectedLayerIds.includes(layer.id) && !isLayerEffectivelyLocked(layer, document));
    const transforms = operation === 'horizontal' || operation === 'vertical'
      ? distributeLayerTransforms(movable, operation)
      : alignLayerTransformsToSelection(movable, operation);
    if (transforms.size === 0) return;
    commit(current => ({
      ...current,
      layers: current.layers.map(layer => transforms.has(layer.id)
        ? { ...layer, transform: transforms.get(layer.id)! }
        : layer),
    }));
  };

  const commit = (updater: (current: PhoenixMediaDocument) => PhoenixMediaDocument) => {
    setHistory(current => {
      if (!current) return current;
      return commitDocumentHistory(current, updater(current.present));
    });
  };

  const patchGroup = (groupId: string, patch: Partial<NonNullable<PhoenixMediaDocument['groups']>[number]>) => {
    commit(current => ({
      ...current,
      groups: (current.groups || []).map(group => group.id === groupId ? { ...group, ...patch } : group),
    }));
  };

  const addGroup = () => {
    const groupId = crypto.randomUUID();
    commit(current => ({
      ...current,
      groups: [...(current.groups || []), {
        id: groupId,
        name: `Group ${(current.groups || []).length + 1}`,
        visible: true,
        locked: false,
        opacity: 1,
      }],
      layers: selectedLayerId
        ? current.layers.map(layer => layer.id === selectedLayerId ? { ...layer, groupId } : layer)
        : current.layers,
    }));
  };

  const deleteGroup = (groupId: string) => {
    commit(current => ({
      ...current,
      groups: (current.groups || []).filter(group => group.id !== groupId),
      layers: current.layers.map(layer => layer.groupId === groupId ? { ...layer, groupId: undefined } : layer),
    }));
  };


  const createSymbolFromSelected = () => {
    if (!document || !selected || selected.symbolId) return;
    if ((document.symbols || []).some(symbol => symbol.masterLayerId === selected.id)) return;
    const symbolId = crypto.randomUUID();
    commit(current => ({
      ...current,
      symbols: [...(current.symbols || []), {
        id: symbolId,
        name: selected.name || `Symbol ${(current.symbols || []).length + 1}`,
        masterLayerId: selected.id,
      }],
    }));
  };

  const insertSymbol = (symbolId: string) => {
    if (!document) return;
    const instance = createSymbolInstance(document, symbolId, nextLayerZIndex(document.layers));
    if (!instance) return;
    commit(current => ({ ...current, layers: [...current.layers, instance] }));
    focusLayer(instance.id);
  };

  const detachSelectedSymbol = () => {
    if (!document || !selected?.symbolId) return;
    const detached = detachSymbolInstance(document, selected);
    commit(current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === selected.id ? detached : layer),
    }));
  };

  const quantize = (value: number) => snapValue(value);

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
    focusLayer(layer.id);
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
    focusLayer(layer.id);
  };

  const addPath = () => {
    if (!document) return;
    const width = Math.round(document.width * 0.32);
    const height = Math.round(document.height * 0.24);
    const layer: PhoenixMediaLayer = {
      id: crypto.randomUUID(),
      type: 'path',
      name: 'Vector Path',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 180, y: 260, width, height, rotation: 0 },
      points: [
        { x: width / 2, y: 0 },
        { x: width, y: height / 2 },
        { x: width / 2, y: height },
        { x: 0, y: height / 2 },
      ],
      closed: true,
      fill: '#0ea5e9',
      stroke: '#bae6fd',
      strokeWidth: 6,
    };
    commit(current => ({ ...current, layers: [...current.layers, layer] }));
    focusLayer(layer.id);
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
    focusLayer(layer.id);
  };

  const patchLayer = (patch: Partial<PhoenixMediaLayer>) => {
    if (!selected) return;
    commit(current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === selected.id ? ({ ...layer, ...patch } as PhoenixMediaLayer) : layer),
    }));
  };


  const deleteSelectedLayers = () => {
    if (!document || selectedLayerIds.length === 0) return;
    commit(current => selectedLayerIds.reduce(
      (nextDocument, layerId) => removeLayerPreservingSymbols(nextDocument, layerId),
      current,
    ));
    focusLayer('');
  };

  const duplicateSelectedLayers = () => {
    if (!document || selectedLayerIds.length === 0) return;
    const selectedLayers = document.layers.filter(layer => selectedLayerIds.includes(layer.id));
    if (selectedLayers.length === 0) return;
    const baseZ = nextLayerZIndex(document.layers);
    const duplicates = selectedLayers.map((layer, index) => {
      const duplicate = structuredClone(layer) as PhoenixMediaLayer;
      duplicate.id = crypto.randomUUID();
      duplicate.name = `${layer.name} copy`;
      duplicate.zIndex = baseZ + index;
      duplicate.transform = clampLayerTransform({
        ...layer.transform,
        x: layer.transform.x + 24,
        y: layer.transform.y + 24,
      }, document);
      return duplicate;
    });
    commit(current => ({ ...current, layers: [...current.layers, ...duplicates] }));
    focusLayer(duplicates[0].id);
  };

  const nudgeSelection = (dx: number, dy: number) => {
    if (!document || selectedLayerIds.length === 0) return;
    commit(current => ({
      ...current,
      layers: current.layers.map(layer => {
        if (!selectedLayerIds.includes(layer.id) || isLayerEffectivelyLocked(layer, current)) return layer;
        return {
          ...layer,
          transform: clampLayerTransform({
            ...layer.transform,
            x: layer.transform.x + dx,
            y: layer.transform.y + dy,
          }, current),
        };
      }),
    }));
  };

  useMediaEditorShortcuts({
    onUndo: () => setHistory(current => current ? undoDocumentHistory(current) : current),
    onRedo: () => setHistory(current => current ? redoDocumentHistory(current) : current),
    onDelete: deleteSelectedLayers,
    onDuplicate: duplicateSelectedLayers,
    onNudge: nudgeSelection,
  });

  const commitSelectedTransform = (transform: PhoenixMediaLayer['transform']) => {
    if (!selected) return;
    const nextTransform = {
      ...transform,
      rotation: selected.type === 'adjustment' ? 0 : transform.rotation,
      width: Math.max(1, transform.width),
      height: Math.max(1, transform.height),
    };
    const scaleX = selected.transform.width > 0 ? nextTransform.width / selected.transform.width : 1;
    const scaleY = selected.transform.height > 0 ? nextTransform.height / selected.transform.height : 1;
    const patch: Partial<PhoenixMediaLayer> = {
      transform: nextTransform,
      vectorMask: scaleVectorMask(selected.vectorMask, scaleX, scaleY),
    } as Partial<PhoenixMediaLayer>;
    if (selected.type === 'path' && !selected.symbolId) {
      Object.assign(patch, {
        points: scaleVectorPoints(selected.points, scaleX, scaleY),
        contours: scaleVectorContours(selected.contours, scaleX, scaleY),
      });
    }
    patchLayer(patch);
  };

  const patchTransform = (key: keyof PhoenixMediaLayer['transform'], value: number) => {
    if (!selected) return;
    const nextValue = key === 'rotation' ? value : quantize(value);
    commitSelectedTransform({
      ...selected.transform,
      [key]: key === 'width' || key === 'height' ? Math.max(1, nextValue) : nextValue,
    });
  };

  const exportFlattened = async (format: PhoenixRasterExportFormat) => {
    if (!document || exportingFormat) return;
    setExportingFormat(format);
    setExportError('');
    try {
      const blob = await exportPhoenixMediaDocument(document, format);
      downloadMediaBlob(blob, document.title, format);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Design export failed.');
    } finally {
      setExportingFormat(null);
    }
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
            <Button size="sm" variant="secondary" loading={exportingFormat === 'png'} onClick={() => void exportFlattened('png')}>PNG</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'jpeg'} onClick={() => void exportFlattened('jpeg')}>JPEG</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'webp'} onClick={() => void exportFlattened('webp')}>WebP</Button>
            <Button size="sm" variant="gold" onClick={exportSvg}>SVG</Button>
            <MediaDocumentIO
              document={document}
              onImport={imported => {
                setHistory(createDocumentHistory(imported));
                focusLayer('');
                setExportError('');
              }}
              onError={setExportError}
            />
          </div>
        }
      />

      {exportError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Export failed: {exportError}
        </div>
      )}
      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <LayerGroupPanel
            groups={document.groups || []}
            onCreate={addGroup}
            onPatch={patchGroup}
            onDelete={deleteGroup}
          />
          <div className="mt-4">
            <SymbolPanel
              symbols={document.symbols || []}
              selectedLayer={selected}
              onCreateFromSelected={createSymbolFromSelected}
              onInsert={insertSymbol}
              onSelectMaster={focusLayer}
              onDetachSelected={detachSelectedSymbol}
            />
          </div>
          <p className="mb-3 mt-6 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Presets</p>
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
              <Button size="sm" variant="secondary" onClick={addPath}>Vector Path</Button>
              <Button size="sm" variant="secondary" onClick={() => {
                const layer = createAdjustmentLayer(document);
                commit(current => ({ ...current, layers: [...current.layers, layer] }));
                focusLayer(layer.id);
              }}>Adjustment</Button>
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

          <div
            ref={scrollRef}
            {...panHandlers}
            className="relative mt-4 min-h-[680px] cursor-grab overflow-auto rounded-lg border border-white/5 bg-[#03050a] p-10 active:cursor-grabbing"
          >
            <div className="relative mx-auto w-max pt-6 pl-6">
              <MediaRulers width={document.width} height={document.height} zoom={zoom} visible={showRulers} />
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

              {sortedLayers.map(rawLayer => {
                if (!isLayerEffectivelyVisible(rawLayer, document)) return null;
                const layer = resolveSymbolLayer(document, rawLayer);
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: layer.transform.x * zoom,
                  top: layer.transform.y * zoom,
                  width: layer.transform.width * zoom,
                  height: layer.transform.height * zoom,
                  opacity: effectiveLayerOpacity(layer, document),
                  transform: `rotate(${layer.transform.rotation}deg)`,
                  transformOrigin: 'center',
                  outline: selectedLayerIds.includes(layer.id) ? '2px solid #38bdf8' : undefined,
                  outlineOffset: 2,
                  clipPath: vectorMaskCssClipPath(layer) || cssMaskClipPath(layer),
                  filter: layerCssEffects(layer),
                };
                if (layer.type === 'adjustment') {
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      data-media-interactive="true"
                      onClick={event => selectLayer(layer.id, event.shiftKey)}
                      className="absolute block border-0 p-0"
                      aria-label={`Select layer ${layer.name}`}
                      style={{
                        ...style,
                        filter: 'none',
                        backdropFilter: layerCssFilter(layer),
                        WebkitBackdropFilter: layerCssFilter(layer),
                        background: 'rgba(0,0,0,0.001)',
                      }}
                    />
                  );
                }

                return (
                  <button key={layer.id} type="button" data-media-interactive="true" onClick={event => selectLayer(layer.id, event.shiftKey)} style={style} className="block border-0 bg-transparent p-0 text-left">
                    {layer.type === 'shape' && <div className="h-full w-full" style={{ background: gradientFillCss(layer.gradient, layer.fill), border: layer.strokeWidth ? `${Math.max(1, layer.strokeWidth * zoom)}px solid ${layer.stroke}` : undefined }} />}
                    {layer.type === 'text' && <div className="h-full w-full overflow-hidden whitespace-pre-wrap" style={{ color: layer.color, fontSize: layer.fontSize * zoom, fontFamily: layer.fontFamily, fontWeight: layer.fontWeight, fontStyle: layer.italic ? 'italic' : 'normal', textDecoration: layer.underline ? 'underline' : 'none', letterSpacing: textLetterSpacing(layer) * zoom, lineHeight: `${textLineHeight(layer) * zoom}px`, textAlign: layer.align }}>{layer.text}</div>}
                    {layer.type === 'path' && (
                      <svg viewBox={`0 0 ${layer.transform.width} ${layer.transform.height}`} className="h-full w-full overflow-visible">
                        {layer.gradient && (
                          <defs>
                            {layer.gradient.kind === 'radial' ? (
                              <radialGradient id={`design-gradient-${layer.id}`} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={layer.gradient.start} />
                                <stop offset="100%" stopColor={layer.gradient.end} />
                              </radialGradient>
                            ) : (
                              <linearGradient id={`design-gradient-${layer.id}`} x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform={`rotate(${layer.gradient.angle - 90} .5 .5)`}>
                                <stop offset="0%" stopColor={layer.gradient.start} />
                                <stop offset="100%" stopColor={layer.gradient.end} />
                              </linearGradient>
                            )}
                          </defs>
                        )}
                        {vectorPathFillSvgD(layer) && (
                          <path d={vectorPathFillSvgD(layer)} fill={layer.gradient ? `url(#design-gradient-${layer.id})` : layer.fill} fillRule={vectorPathFillRule(layer)} stroke="none" />
                        )}
                        <path d={vectorPathSvgD(layer)} fill="none" stroke={layer.stroke} strokeWidth={layer.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
                        {selectedLayerId === layer.id && !layer.symbolId && layer.points.map((point, index) => (
                          <g key={index} className="pointer-events-none">
                            {point.in && (
                              <>
                                <line x1={point.x} y1={point.y} x2={point.in.x} y2={point.in.y} stroke="#67e8f9" strokeWidth={1.5 / zoom} />
                                <circle cx={point.in.x} cy={point.in.y} r={5 / zoom} fill="#0e7490" stroke="#cffafe" strokeWidth={1 / zoom} />
                              </>
                            )}
                            {point.out && (
                              <>
                                <line x1={point.x} y1={point.y} x2={point.out.x} y2={point.out.y} stroke="#67e8f9" strokeWidth={1.5 / zoom} />
                                <circle cx={point.out.x} cy={point.out.y} r={5 / zoom} fill="#0e7490" stroke="#cffafe" strokeWidth={1 / zoom} />
                              </>
                            )}
                            <circle cx={point.x} cy={point.y} r={6 / zoom} fill="#0891b2" stroke="#ecfeff" strokeWidth={1.5 / zoom} />
                          </g>
                        ))}
                      </svg>
                    )}
                    {layer.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: layer.fit }} />
                    )}
                    {layer.type === 'raster' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: 'fill' }} />
                    )}
                  </button>
                );
              })}
              {selected && selected.visible && (
                <LayerTransformControls
                  transform={selected.transform}
                  zoom={zoom}
                  canvasWidth={document.width}
                  canvasHeight={document.height}
                  locked={isLayerEffectivelyLocked(selected, document)}
                  allowMove={selected.type !== 'raster'}
                  snapValue={snapValue}
                  onCommit={commitSelectedTransform}
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
              <button key={layer.id} type="button" data-media-interactive="true" onClick={event => selectLayer(layer.id, event.shiftKey)}
                className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-xs ${selectedLayerId === layer.id ? 'border-blue-400/50 bg-blue-400/10 text-blue-100' : 'border-white/5 text-slate-400'}`}>
                <span className="truncate">{layer.name}</span><span className="text-[9px] uppercase">{layer.type}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <MultiLayerLayoutPanel
              count={document.layers.filter(layer => selectedLayerIds.includes(layer.id) && !isLayerEffectivelyLocked(layer, document)).length}
              onAlign={alignment => applyBatchLayout(alignment)}
              onDistribute={axis => applyBatchLayout(axis)}
              onClear={() => setAdditionalLayerIds([])}
            />
          </div>

          {selected && (
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <label className="block text-[10px] uppercase text-slate-500">Name
                <input value={selected.name} onChange={event => patchLayer({ name: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-black/20 px-2 text-white" />
              </label>
              <label className="block text-[10px] uppercase text-slate-500">Layer Group
                <select
                  value={selected.groupId || ''}
                  onChange={event => patchLayer({ groupId: event.target.value || undefined } as Partial<PhoenixMediaLayer>)}
                  className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-white"
                >
                  <option value="">No Group</option>
                  {(document.groups || []).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>

              <VectorMaskPanel
                layer={selected}
                onChange={patch => patchLayer(patch)}
              />

              {selected.type === 'adjustment' && (
                <AdjustmentLayerPanel
                  layer={selected}
                  onChange={patch => patchLayer(patch)}
                />
              )}

              {selected.type !== 'adjustment' && (
                <LayerShadowPanel
                  layer={selected}
                  onChange={patch => patchLayer(patch)}
                />
              )}

              {!selected.symbolId && selected.type === 'text' && (
                <>
                  <label className="block text-[10px] uppercase text-slate-500">Text
                    <textarea value={selected.text} onChange={event => patchLayer({ text: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 min-h-20 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] uppercase text-slate-500">Color
                      <input type="color" value={selected.color} onChange={event => patchLayer({ color: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Size
                      <input type="number" min={8} max={300} value={selected.fontSize} onChange={event => patchLayer({ fontSize: Number(event.target.value) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Line height
                      <input type="number" min={0.5} max={4} step={0.05} value={selected.lineHeight ?? 1.08} onChange={event => patchLayer({ lineHeight: Number(event.target.value) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Tracking px
                      <input type="number" min={-20} max={200} step={0.5} value={selected.letterSpacing ?? 0} onChange={event => patchLayer({ letterSpacing: Number(event.target.value) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={selected.align} onChange={event => patchLayer({ align: event.target.value as 'left' | 'center' | 'right' } as Partial<PhoenixMediaLayer>)} className="min-h-10 rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                    <Button size="sm" variant={selected.italic ? 'gold' : 'ghost'} onClick={() => patchLayer({ italic: !selected.italic } as Partial<PhoenixMediaLayer>)}>Italic</Button>
                    <Button size="sm" variant={selected.underline ? 'gold' : 'ghost'} onClick={() => patchLayer({ underline: !selected.underline } as Partial<PhoenixMediaLayer>)}>Underline</Button>
                  </div>
                </>
              )}
              {!selected.symbolId && selected.type === 'shape' && (
                <label className="block text-[10px] uppercase text-slate-500">Fill
                  <input type="color" value={selected.fill} onChange={event => patchLayer({ fill: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full" />
                </label>
              )}
              {!selected.symbolId && selected.type === 'path' && (
                <div className="space-y-3 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Vector Nodes</span>
                    <Button size="sm" variant="ghost" onClick={() => patchLayer({ points: [...selected.points, { x: selected.transform.width / 2, y: selected.transform.height / 2 }] } as Partial<PhoenixMediaLayer>)}>Add Node</Button>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-auto">
                    {selected.points.map((point, index) => {
                      const curved = Boolean(point.in || point.out);
                      return (
                        <div key={index} className="rounded border border-white/10 bg-black/10 p-2">
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <input
                              type="number"
                              value={Math.round(point.x)}
                              onChange={event => {
                                const x = Math.max(0, Math.min(selected.transform.width, Number(event.target.value)));
                                patchLayer({ points: selected.points.map((item, pointIndex) => pointIndex === index ? moveVectorPoint(item, x, item.y) : item) } as Partial<PhoenixMediaLayer>);
                              }}
                              aria-label={`Node ${index + 1} X`}
                              className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                            />
                            <input
                              type="number"
                              value={Math.round(point.y)}
                              onChange={event => {
                                const y = Math.max(0, Math.min(selected.transform.height, Number(event.target.value)));
                                patchLayer({ points: selected.points.map((item, pointIndex) => pointIndex === index ? moveVectorPoint(item, item.x, y) : item) } as Partial<PhoenixMediaLayer>);
                              }}
                              aria-label={`Node ${index + 1} Y`}
                              className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                            />
                            <Button size="sm" variant="ghost" disabled={selected.points.length <= 2} onClick={() => patchLayer({ points: selected.points.filter((_, pointIndex) => pointIndex !== index) } as Partial<PhoenixMediaLayer>)}>×</Button>
                          </div>
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant={curved ? 'gold' : 'ghost'}
                              onClick={() => {
                                const handle = Math.max(20, Math.min(60, selected.transform.width * 0.1));
                                const points = selected.points.map((item, pointIndex) => pointIndex !== index ? item : curved
                                  ? { ...item, in: undefined, out: undefined }
                                  : {
                                      ...item,
                                      in: { x: Math.max(0, item.x - handle), y: item.y },
                                      out: { x: Math.min(selected.transform.width, item.x + handle), y: item.y },
                                    });
                                patchLayer({ points } as Partial<PhoenixMediaLayer>);
                              }}
                            >
                              {curved ? 'Curve' : 'Make Curve'}
                            </Button>
                          </div>
                          {curved && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {(['in', 'out'] as const).map(handleKey => {
                                const handle = point[handleKey] || { x: point.x, y: point.y };
                                return (
                                  <div key={handleKey} className="rounded border border-white/5 p-2">
                                    <div className="mb-1 text-[9px] font-bold uppercase text-slate-500">{handleKey} handle</div>
                                    <div className="grid grid-cols-2 gap-1">
                                      {(['x', 'y'] as const).map(axis => (
                                        <input
                                          key={axis}
                                          type="number"
                                          value={Math.round(handle[axis])}
                                          aria-label={`Node ${index + 1} ${handleKey} ${axis}`}
                                          onChange={event => {
                                            const value = Number(event.target.value);
                                            patchLayer({
                                              points: selected.points.map((item, pointIndex) => pointIndex === index
                                                ? { ...item, [handleKey]: { ...(item[handleKey] || { x: item.x, y: item.y }), [axis]: value } }
                                                : item),
                                            } as Partial<PhoenixMediaLayer>);
                                          }}
                                          className="min-w-0 rounded border border-white/10 bg-black/20 p-1 text-[10px] text-white"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase text-slate-500">Fill
                      <input type="color" value={selected.fill} onChange={event => patchLayer({ fill: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Stroke
                      <input type="color" value={selected.stroke} onChange={event => patchLayer({ stroke: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase text-slate-500">Stroke px
                      <input type="number" min={0} max={100} value={selected.strokeWidth} onChange={event => patchLayer({ strokeWidth: Math.max(0, Number(event.target.value)) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <Button size="sm" variant={selected.closed ? 'gold' : 'ghost'} className="mt-5" onClick={() => patchLayer({ closed: !selected.closed } as Partial<PhoenixMediaLayer>)}>
                      {selected.closed ? 'Closed' : 'Open'}
                    </Button>
                  </div>
                </div>
              )}
              {!selected.symbolId && selected.type === 'path' && (
                <CompoundContourPanel
                  layer={selected}
                  onChange={patch => patchLayer(patch as Partial<PhoenixMediaLayer>)}
                />
              )}

              {!selected.symbolId && (selected.type === 'shape' || selected.type === 'path') && (
                <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-300">Gradient Fill</span>
                    <Button
                      size="sm"
                      variant={selected.gradient ? 'gold' : 'ghost'}
                      onClick={() => patchLayer({
                        gradient: selected.gradient ? undefined : {
                          kind: 'linear',
                          angle: 90,
                          start: selected.fill,
                          end: '#111827',
                        },
                      } as Partial<PhoenixMediaLayer>)}
                    >
                      {selected.gradient ? 'On' : 'Enable'}
                    </Button>
                  </div>
                  {selected.gradient && (
                    <div className="mt-3 space-y-2">
                      <select
                        value={selected.gradient.kind}
                        onChange={event => patchLayer({ gradient: { ...selected.gradient!, kind: event.target.value as 'linear' | 'radial' } } as Partial<PhoenixMediaLayer>)}
                        className="min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white"
                      >
                        <option value="linear">Linear</option>
                        <option value="radial">Radial</option>
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] uppercase text-slate-500">Start
                          <input type="color" value={selected.gradient.start} onChange={event => patchLayer({ gradient: { ...selected.gradient!, start: event.target.value } } as Partial<PhoenixMediaLayer>)} className="mt-1 h-9 w-full" />
                        </label>
                        <label className="text-[10px] uppercase text-slate-500">End
                          <input type="color" value={selected.gradient.end} onChange={event => patchLayer({ gradient: { ...selected.gradient!, end: event.target.value } } as Partial<PhoenixMediaLayer>)} className="mt-1 h-9 w-full" />
                        </label>
                      </div>
                      {selected.gradient.kind === 'linear' && (
                        <label className="block text-[10px] uppercase text-slate-500">Angle
                          <input type="number" min={-360} max={360} value={selected.gradient.angle} onChange={event => patchLayer({ gradient: { ...selected.gradient!, angle: Number(event.target.value) } } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <LayerAlignmentPanel
                transform={selected.transform}
                document={document}
                onCommit={commitSelectedTransform}
              />

              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map(key => (
                  <label key={key} className="text-[10px] uppercase text-slate-500">{key}
                    <input type="number" value={Math.round(selected.transform[key])} onChange={event => patchTransform(key, Number(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                  </label>
                ))}
              </div>
              <Button size="sm" variant="danger" className="w-full" onClick={deleteSelectedLayers}>Delete Selected</Button>
            </div>
          )}
        </aside>
      </div>
    </Navigation>
  );
}
