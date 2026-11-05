'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RasterPaintCanvas } from '@/components/media/RasterPaintCanvas';
import { MediaViewportToolbar } from '@/components/media/MediaViewportToolbar';
import { MediaRulers } from '@/components/media/MediaRulers';
import { LayerTransformControls } from '@/components/media/LayerTransformControls';
import { MediaRevisionPanel } from '@/components/media/MediaRevisionPanel';
import { LayerGroupPanel } from '@/components/media/LayerGroupPanel';
import { CompoundContourPanel } from '@/components/media/CompoundContourPanel';
import { SymbolPanel } from '@/components/media/SymbolPanel';
import { VectorMaskPanel } from '@/components/media/VectorMaskPanel';
import { LayerShadowPanel } from '@/components/media/LayerShadowPanel';
import { MediaDocumentIO } from '@/components/media/MediaDocumentIO';
import { LayerAlignmentPanel } from '@/components/media/LayerAlignmentPanel';
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
  normalizeLayerAdjustments,
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
  const [additionalLayerIds, setAdditionalLayerIds] = useState<string[]>([]);

  const focusLayer = (layerId: string) => {
    setSelectedLayerId(layerId);
    setAdditionalLayerIds([]);
  };

  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState('');
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(24);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [eraseMode, setEraseMode] = useState(false);
  const [selection, setSelection] = useState({ x: 120, y: 120, width: 600, height: 600 });
  const [lassoMode, setLassoMode] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);
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
  } = useMediaViewport(0.6);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (cancelled) return;
        setProject(loadedProject);
        const localDocument = loadPhoenixMediaDocument(id, 'image');
        const cloudDocument = isDbMode() ? await dbGetMediaDocument(id, 'image') : null;
        const loadedDocument = cloudDocument || localDocument || createPhoenixMediaDocument(id, 'image');
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
      if (isDbMode()) {
        void dbSaveMediaDocument(id, saved)
          .catch(error => setExportError(error instanceof Error ? error.message : 'Cloud autosave failed.'));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [document, id, loading]);

  const sortedLayers = useMemo(
    () => [...(document?.layers || [])].sort((a, b) => a.zIndex - b.zIndex),
    [document?.layers],
  );

  const selectedLayer = document?.layers.find(layer => layer.id === selectedLayerId) || null;

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
    updateDocument(current => ({
      ...current,
      layers: current.layers.map(layer => transforms.has(layer.id)
        ? { ...layer, transform: transforms.get(layer.id)! }
        : layer),
    }));
  };

  const updateDocument = (updater: (current: PhoenixMediaDocument) => PhoenixMediaDocument) => {
    setHistory(current => {
      if (!current) return current;
      return commitDocumentHistory(current, updater(current.present));
    });
  };

  const patchGroup = (groupId: string, patch: Partial<NonNullable<PhoenixMediaDocument['groups']>[number]>) => {
    updateDocument(current => ({
      ...current,
      groups: (current.groups || []).map(group => group.id === groupId ? { ...group, ...patch } : group),
    }));
  };

  const addGroup = () => {
    const groupId = crypto.randomUUID();
    updateDocument(current => ({
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
    updateDocument(current => ({
      ...current,
      groups: (current.groups || []).filter(group => group.id !== groupId),
      layers: current.layers.map(layer => layer.groupId === groupId ? { ...layer, groupId: undefined } : layer),
    }));
  };


  const createSymbolFromSelected = () => {
    if (!document || !selectedLayer || selectedLayer.symbolId) return;
    if ((document.symbols || []).some(symbol => symbol.masterLayerId === selectedLayer.id)) return;
    const symbolId = crypto.randomUUID();
    updateDocument(current => ({
      ...current,
      symbols: [...(current.symbols || []), {
        id: symbolId,
        name: selectedLayer.name || `Symbol ${(current.symbols || []).length + 1}`,
        masterLayerId: selectedLayer.id,
      }],
    }));
  };

  const insertSymbol = (symbolId: string) => {
    if (!document) return;
    const instance = createSymbolInstance(document, symbolId, nextLayerZIndex(document.layers));
    if (!instance) return;
    updateDocument(current => ({ ...current, layers: [...current.layers, instance] }));
    focusLayer(instance.id);
  };

  const detachSelectedSymbol = () => {
    if (!document || !selectedLayer?.symbolId) return;
    const detached = detachSymbolInstance(document, selectedLayer);
    updateDocument(current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === selectedLayer.id ? detached : layer),
    }));
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
    focusLayer(id);
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
    focusLayer(id);
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
    focusLayer(id);
  };

  const addPathLayer = () => {
    if (!document) return;
    const id = crypto.randomUUID();
    const width = 420;
    const height = 420;
    const layer: PhoenixMediaLayer = {
      id,
      type: 'path',
      name: 'Vector Path',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      zIndex: nextLayerZIndex(document.layers),
      transform: { x: 260, y: 260, width, height, rotation: 0 },
      points: [
        { x: width / 2, y: 0 },
        { x: width, y: height / 2 },
        { x: width / 2, y: height },
        { x: 0, y: height / 2 },
      ],
      closed: true,
      fill: '#7c3aed',
      stroke: '#c4b5fd',
      strokeWidth: 8,
    };
    updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
    focusLayer(id);
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
    focusLayer(layerId);
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

  const commitSelectedTransform = (transform: PhoenixMediaLayer['transform']) => {
    if (!selectedLayer || !document) return;
    const nextTransform = clampLayerTransform(
      selectedLayer.type === 'adjustment' ? { ...transform, rotation: 0 } : transform,
      document,
    );
    const scaleX = selectedLayer.transform.width > 0 ? nextTransform.width / selectedLayer.transform.width : 1;
    const scaleY = selectedLayer.transform.height > 0 ? nextTransform.height / selectedLayer.transform.height : 1;
    const patch: Partial<PhoenixMediaLayer> = {
      transform: nextTransform,
      vectorMask: scaleVectorMask(selectedLayer.vectorMask, scaleX, scaleY),
    } as Partial<PhoenixMediaLayer>;
    if (selectedLayer.type === 'path' && !selectedLayer.symbolId) {
      Object.assign(patch, {
        points: scaleVectorPoints(selectedLayer.points, scaleX, scaleY),
        contours: scaleVectorContours(selectedLayer.contours, scaleX, scaleY),
      });
    }
    patchSelectedLayer(patch);
  };

  const patchTransform = (key: keyof PhoenixMediaLayer['transform'], value: number) => {
    if (!selectedLayer) return;
    const nextValue = key === 'rotation' ? value : snapValue(value);
    commitSelectedTransform({
      ...selectedLayer.transform,
      [key]: key === 'width' || key === 'height' ? Math.max(1, nextValue) : nextValue,
    });
  };

  const deleteSelectedLayer = () => {
    if (!document || selectedLayerIds.length === 0) return;
    updateDocument(current => selectedLayerIds.reduce(
      (nextDocument, layerId) => removeLayerPreservingSymbols(nextDocument, layerId),
      current,
    ));
    focusLayer('');
  };

  const duplicateSelectedLayer = () => {
    if (!document || selectedLayerIds.length === 0) return;
    const selected = document.layers.filter(layer => selectedLayerIds.includes(layer.id));
    if (selected.length === 0) return;
    const baseZ = nextLayerZIndex(document.layers);
    const duplicates = selected.map((layer, index) => {
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
    updateDocument(current => ({ ...current, layers: [...current.layers, ...duplicates] }));
    focusLayer(duplicates[0].id);
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

  const nudgeSelection = (dx: number, dy: number) => {
    if (!document || selectedLayerIds.length === 0) return;
    updateDocument(current => ({
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
    onDelete: deleteSelectedLayer,
    onDuplicate: duplicateSelectedLayer,
    onNudge: nudgeSelection,
  });

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
      vectorMask: undefined,
      mask: {
        x: left - selectedLayer.transform.x,
        y: top - selectedLayer.transform.y,
        width: right - left,
        height: bottom - top,
      },
    } as Partial<PhoenixMediaLayer>);
  };

  const exportFlattened = async (format: PhoenixRasterExportFormat) => {
    if (!document || exportingFormat) return;
    setExportingFormat(format);
    setExportError('');
    try {
      const blob = await exportPhoenixMediaDocument(document, format);
      downloadMediaBlob(blob, document.title, format);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Image export failed.');
    } finally {
      setExportingFormat(null);
    }
  };

  const selectedLayerClipPath = (layer: PhoenixMediaLayer): string | undefined => {
    if (!layer.mask) return undefined;
    const top = Math.max(0, (layer.mask.y / layer.transform.height) * 100);
    const left = Math.max(0, (layer.mask.x / layer.transform.width) * 100);
    const right = Math.max(0, ((layer.transform.width - layer.mask.x - layer.mask.width) / layer.transform.width) * 100);
    const bottom = Math.max(0, ((layer.transform.height - layer.mask.y - layer.mask.height) / layer.transform.height) * 100);
    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  };

  const addLassoPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!lassoMode || !document) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(document.width, (event.clientX - bounds.left) / scale));
    const y = Math.max(0, Math.min(document.height, (event.clientY - bounds.top) / scale));
    setLassoPoints(points => [...points, { x, y }]);
  };

  const applyLassoMask = () => {
    if (!document || !selectedLayer || lassoPoints.length < 3) return;
    if (isLayerEffectivelyLocked(selectedLayer, document)) {
      setExportError('Unlock the selected layer before applying a lasso mask.');
      return;
    }

    const { x, y, width, height } = selectedLayer.transform;
    const localPoints = lassoPoints.map(point => ({
      x: Math.max(0, Math.min(width, point.x - x)),
      y: Math.max(0, Math.min(height, point.y - y)),
    }));

    updateDocument(current => ({
      ...current,
      layers: current.layers.map(layer =>
        layer.id === selectedLayer.id
          ? { ...layer, vectorMask: { points: localPoints } }
          : layer
      ),
    }));
    setLassoMode(false);
    setLassoPoints([]);
    setExportError('');
  };

  const clearLasso = () => {
    setLassoMode(false);
    setLassoPoints([]);
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

  const scale = zoom;

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
            <Button size="sm" variant="secondary" loading={exportingFormat === 'png'} onClick={() => void exportFlattened('png')}>PNG</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'jpeg'} onClick={() => void exportFlattened('jpeg')}>JPEG</Button>
            <Button size="sm" variant="secondary" loading={exportingFormat === 'webp'} onClick={() => void exportFlattened('webp')}>WebP</Button>
            <MediaRevisionPanel
              projectId={id}
              kind={document.kind}
              currentVersion={document.version}
              enabled={isDbMode()}
              onRestore={restored => {
                setHistory(createDocumentHistory(restored));
                setSelectedLayerId('');
                setAdditionalLayerIds([]);
              }}
              onError={setExportError}
            />
            <MediaDocumentIO
              document={document}
              onImport={imported => {
                setHistory(createDocumentHistory(imported));
                focusLayer('');
                setExportError('');
              }}
              onError={setExportError}
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{document.width} × {document.height}</span>
              <span>•</span>
              <span>{savedAt ? 'Autosaved' : 'Ready'}</span>
            </div>
          </div>
        }
      />

      {exportError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Export failed: {exportError}
        </div>
      )}
      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
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
              selectedLayer={selectedLayer}
              onCreateFromSelected={createSymbolFromSelected}
              onInsert={insertSymbol}
              onSelectMaster={focusLayer}
              onDetachSelected={detachSelectedSymbol}
            />
          </div>
          <p className="mb-3 mt-6 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Create</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={addTextLayer}>Text</Button>
            <Button size="sm" variant="secondary" onClick={() => addShapeLayer('rectangle')}>Rectangle</Button>
            <Button size="sm" variant="secondary" onClick={() => addShapeLayer('ellipse')}>Ellipse</Button>
            <Button size="sm" variant="secondary" onClick={addPathLayer}>Vector Path</Button>
            <Button size="sm" variant="secondary" onClick={() => {
              const layer = createAdjustmentLayer(document);
              updateDocument(current => ({ ...current, layers: [...current.layers, layer] }));
              focusLayer(layer.id);
            }}>Adjustment</Button>
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
              <Button
                size="sm"
                variant={lassoMode ? "secondary" : "ghost"}
                disabled={!selectedLayer}
                onClick={() => {
                  setLassoMode(value => !value);
                  setLassoPoints([]);
                  setExportError('');
                }}
              >
                {lassoMode ? 'Lasso: click canvas points' : 'Start Polygon Lasso'}
              </Button>
              {lassoMode && (
                <>
                  <Button size="sm" variant="ghost" disabled={lassoPoints.length < 3} onClick={applyLassoMask}>
                    Apply Lasso Mask ({lassoPoints.length} points)
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearLasso}>Cancel Lasso</Button>
                </>
              )}
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
              Layers, raster painting, editable vector paths, rectangular and polygon-lasso selections, cropping, masks, undo/redo,
              richer blend modes, and non-destructive color adjustments share one persistent cloud-capable document. GPU effects remain a later image-engine tier.
            </p>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-[#04060b] p-4 md:p-6">
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
            className="relative mt-4 min-h-[680px] flex-1 cursor-grab overflow-auto rounded-lg border border-white/5 bg-[#03050a] p-10 active:cursor-grabbing"
          >
            <div className="relative mx-auto w-max pt-6 pl-6">
              <MediaRulers width={document.width} height={document.height} zoom={scale} visible={showRulers} />
              <div
                className="relative origin-top-left overflow-hidden border border-white/15 shadow-2xl"
                style={{
                  width: document.width * scale,
                  height: document.height * scale,
                  background: document.background,
                }}
                aria-label="Image composition canvas"
              >
                {lassoMode && (
                  <div
                    className="absolute inset-0 z-[10000] cursor-crosshair"
                    data-media-interactive="true"
                    onClick={addLassoPoint}
                    aria-label="Polygon lasso capture surface"
                  >
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox={`0 0 ${document.width} ${document.height}`}
                    >
                      {lassoPoints.length > 1 && (
                        <polyline
                          points={lassoPoints.map(point => `${point.x},${point.y}`).join(' ')}
                          fill={lassoPoints.length >= 3 ? 'rgba(34,211,238,0.10)' : 'none'}
                          stroke="#22d3ee"
                          strokeWidth={2 / scale}
                          strokeDasharray={`${8 / scale} ${5 / scale}`}
                        />
                      )}
                      {lassoPoints.map((point, index) => (
                        <circle
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={5 / scale}
                          fill="#0891b2"
                          stroke="#ecfeff"
                          strokeWidth={1.5 / scale}
                        />
                      ))}
                    </svg>
                  </div>
                )}
                {showGuides && (
                  <>
                    <div className="pointer-events-none absolute inset-[5%] z-[9998] border border-dashed border-cyan-300/40" />
                    <div className="pointer-events-none absolute inset-[10%] z-[9998] border border-dashed border-fuchsia-300/30" />
                    <div className="pointer-events-none absolute left-1/2 top-0 z-[9998] h-full border-l border-dashed border-white/20" />
                    <div className="pointer-events-none absolute left-0 top-1/2 z-[9998] w-full border-t border-dashed border-white/20" />
                  </>
                )}
              {sortedLayers.map(rawLayer => {
                if (!isLayerEffectivelyVisible(rawLayer, document)) return null;
                const layer = resolveSymbolLayer(document, rawLayer);
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: layer.transform.x * scale,
                  top: layer.transform.y * scale,
                  width: layer.transform.width * scale,
                  height: layer.transform.height * scale,
                  opacity: effectiveLayerOpacity(layer, document),
                  transform: `rotate(${layer.transform.rotation}deg)`,
                  transformOrigin: 'center',
                  mixBlendMode: layerMixBlendMode(layer.blendMode),
                  outline: selectedLayerIds.includes(layer.id) ? '2px solid #60a5fa' : undefined,
                  outlineOffset: 2,
                  cursor: isLayerEffectivelyLocked(layer, document) ? 'not-allowed' : 'pointer',
                  clipPath: vectorMaskCssClipPath(layer) || selectedLayerClipPath(layer),
                  filter: layerCssEffects(layer),
                };

                if (layer.type === 'adjustment') {
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      data-media-interactive="true"
                      onClick={event => selectLayer(layer.id, event.shiftKey)}
                      aria-label={`Select layer ${layer.name}`}
                      className="absolute block border-0 p-0"
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
                  <button
                    key={layer.id}
                    type="button"
                    data-media-interactive="true"
                    onClick={event => selectLayer(layer.id, event.shiftKey)}
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
                          fontStyle: layer.italic ? 'italic' : 'normal',
                          textDecoration: layer.underline ? 'underline' : 'none',
                          letterSpacing: textLetterSpacing(layer) * scale,
                          textAlign: layer.align,
                          lineHeight: `${textLineHeight(layer) * scale}px`,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {layer.text}
                      </div>
                    )}
                    {layer.type === 'shape' && (
                      <div
                        className="h-full w-full"
                        style={{
                          background: gradientFillCss(layer.gradient, layer.fill),
                          border: layer.strokeWidth ? `${Math.max(1, layer.strokeWidth * scale)}px solid ${layer.stroke}` : undefined,
                          borderRadius: layer.shape === 'ellipse' ? '9999px' : 0,
                        }}
                      />
                    )}
                    {layer.type === 'path' && (
                      <svg viewBox={`0 0 ${layer.transform.width} ${layer.transform.height}`} className="h-full w-full overflow-visible">
                        {layer.gradient && (
                          <defs>
                            {layer.gradient.kind === 'radial' ? (
                              <radialGradient id={`image-gradient-${layer.id}`} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={layer.gradient.start} />
                                <stop offset="100%" stopColor={layer.gradient.end} />
                              </radialGradient>
                            ) : (
                              <linearGradient id={`image-gradient-${layer.id}`} x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform={`rotate(${layer.gradient.angle - 90} .5 .5)`}>
                                <stop offset="0%" stopColor={layer.gradient.start} />
                                <stop offset="100%" stopColor={layer.gradient.end} />
                              </linearGradient>
                            )}
                          </defs>
                        )}
                        {vectorPathFillSvgD(layer) && (
                          <path
                            d={vectorPathFillSvgD(layer)}
                            fill={layer.gradient ? `url(#image-gradient-${layer.id})` : layer.fill}
                            fillRule={vectorPathFillRule(layer)}
                            stroke="none"
                          />
                        )}
                        <path
                          d={vectorPathSvgD(layer)}
                          fill="none"
                          stroke={layer.stroke}
                          strokeWidth={layer.strokeWidth}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {selectedLayerId === layer.id && !layer.symbolId && layer.points.map((point, index) => (
                          <g key={index} className="pointer-events-none">
                            {point.in && (
                              <>
                                <line x1={point.x} y1={point.y} x2={point.in.x} y2={point.in.y} stroke="#67e8f9" strokeWidth={1.5 / scale} />
                                <circle cx={point.in.x} cy={point.in.y} r={5 / scale} fill="#0e7490" stroke="#cffafe" strokeWidth={1 / scale} />
                              </>
                            )}
                            {point.out && (
                              <>
                                <line x1={point.x} y1={point.y} x2={point.out.x} y2={point.out.y} stroke="#67e8f9" strokeWidth={1.5 / scale} />
                                <circle cx={point.out.x} cy={point.out.y} r={5 / scale} fill="#0e7490" stroke="#cffafe" strokeWidth={1 / scale} />
                              </>
                            )}
                            <circle cx={point.x} cy={point.y} r={6 / scale} fill="#0891b2" stroke="#ecfeff" strokeWidth={1.5 / scale} />
                          </g>
                        ))}
                      </svg>
                    )}
                    {layer.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: layer.fit }} />
                    )}
                    {layer.type === 'raster' && (
                      layer.symbolId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={layer.src} alt="" className="h-full w-full" style={{ objectFit: 'fill' }} />
                      ) : (
                        <RasterPaintCanvas
                          layer={layer}
                          scale={scale}
                          selected={selectedLayerId === layer.id}
                          brushColor={brushColor}
                          brushSize={brushSize}
                          brushOpacity={brushOpacity}
                          erase={eraseMode}
                          onSelect={() => focusLayer(layer.id)}
                          onCommit={(src) => {
                            updateDocument(current => ({
                              ...current,
                              layers: current.layers.map(item => item.id === layer.id ? { ...item, src } : item),
                            }));
                          }}
                        />
                      )
                    )}
                  </button>
                );
              })}
              {selectedLayer && selectedLayer.visible && (
                <LayerTransformControls
                  transform={selectedLayer.transform}
                  zoom={scale}
                  canvasWidth={document.width}
                  canvasHeight={document.height}
                  locked={isLayerEffectivelyLocked(selectedLayer, document)}
                  allowMove={selectedLayer.type !== 'raster'}
                  snapValue={snapValue}
                  onCommit={commitSelectedTransform}
                />
              )}
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
                  onClick={event => selectLayer(layer.id, event.shiftKey)}
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

          <div className="mb-4">
            <MultiLayerLayoutPanel
              count={document.layers.filter(layer => selectedLayerIds.includes(layer.id) && !isLayerEffectivelyLocked(layer, document)).length}
              onAlign={alignment => applyBatchLayout(alignment)}
              onDistribute={axis => applyBatchLayout(axis)}
              onClear={() => setAdditionalLayerIds([])}
            />
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

              <label className="block text-[10px] uppercase text-slate-500">Layer Group
                <select
                  value={selectedLayer.groupId || ''}
                  onChange={event => patchSelectedLayer({ groupId: event.target.value || undefined } as Partial<PhoenixMediaLayer>)}
                  className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-white"
                >
                  <option value="">No Group</option>
                  {(document.groups || []).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>

              {!selectedLayer.symbolId && selectedLayer.type === 'text' && (
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
                    <label className="text-[10px] uppercase text-slate-500">Line height
                      <input type="number" min={0.5} max={4} step={0.05} value={selectedLayer.lineHeight ?? 1.08} onChange={event => patchSelectedLayer({ lineHeight: Number(event.target.value) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Tracking px
                      <input type="number" min={-20} max={200} step={0.5} value={selectedLayer.letterSpacing ?? 0} onChange={event => patchSelectedLayer({ letterSpacing: Number(event.target.value) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={selectedLayer.align} onChange={event => patchSelectedLayer({ align: event.target.value as 'left' | 'center' | 'right' } as Partial<PhoenixMediaLayer>)} className="min-h-10 rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                    <Button size="sm" variant={selectedLayer.italic ? 'gold' : 'ghost'} onClick={() => patchSelectedLayer({ italic: !selectedLayer.italic } as Partial<PhoenixMediaLayer>)}>Italic</Button>
                    <Button size="sm" variant={selectedLayer.underline ? 'gold' : 'ghost'} onClick={() => patchSelectedLayer({ underline: !selectedLayer.underline } as Partial<PhoenixMediaLayer>)}>Underline</Button>
                  </div>
                </>
              )}

              {!selectedLayer.symbolId && selectedLayer.type === 'raster' && (
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

              {!selectedLayer.symbolId && selectedLayer.type === 'image' && (
                <label className="block text-[10px] uppercase text-slate-500">Image fit
                  <select
                    value={selectedLayer.fit}
                    onChange={event => patchSelectedLayer({ fit: event.target.value as 'cover' | 'contain' | 'fill' } as Partial<PhoenixMediaLayer>)}
                    className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-white"
                  >
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="fill">Stretch / Fill</option>
                  </select>
                </label>
              )}

              {!selectedLayer.symbolId && selectedLayer.type === 'shape' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] uppercase text-slate-500">Fill
                    <input type="color" value={selectedLayer.fill} onChange={event => patchSelectedLayer({ fill: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                  </label>
                  <label className="text-[10px] uppercase text-slate-500">Stroke
                    <input type="color" value={selectedLayer.stroke} onChange={event => patchSelectedLayer({ stroke: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                  </label>
                </div>
              )}

              {!selectedLayer.symbolId && selectedLayer.type === 'path' && (
                <div className="space-y-3 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Vector Nodes</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => patchSelectedLayer({
                        points: [...selectedLayer.points, { x: selectedLayer.transform.width / 2, y: selectedLayer.transform.height / 2 }],
                      } as Partial<PhoenixMediaLayer>)}
                    >
                      Add Node
                    </Button>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto">
                    {selectedLayer.points.map((point, index) => {
                      const curved = Boolean(point.in || point.out);
                      return (
                        <div key={index} className="rounded border border-white/10 bg-black/10 p-2">
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <input
                              type="number"
                              value={Math.round(point.x)}
                              onChange={event => {
                                const x = Math.max(0, Math.min(selectedLayer.transform.width, Number(event.target.value)));
                                const points = selectedLayer.points.map((item, pointIndex) => pointIndex === index
                                  ? moveVectorPoint(item, x, item.y)
                                  : item);
                                patchSelectedLayer({ points } as Partial<PhoenixMediaLayer>);
                              }}
                              aria-label={`Node ${index + 1} X`}
                              className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                            />
                            <input
                              type="number"
                              value={Math.round(point.y)}
                              onChange={event => {
                                const y = Math.max(0, Math.min(selectedLayer.transform.height, Number(event.target.value)));
                                const points = selectedLayer.points.map((item, pointIndex) => pointIndex === index
                                  ? moveVectorPoint(item, item.x, y)
                                  : item);
                                patchSelectedLayer({ points } as Partial<PhoenixMediaLayer>);
                              }}
                              aria-label={`Node ${index + 1} Y`}
                              className="min-w-0 rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={selectedLayer.points.length <= 2}
                              onClick={() => patchSelectedLayer({
                                points: selectedLayer.points.filter((_, pointIndex) => pointIndex !== index),
                              } as Partial<PhoenixMediaLayer>)}
                            >
                              ×
                            </Button>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant={curved ? 'gold' : 'ghost'}
                              onClick={() => {
                                const handle = Math.max(20, Math.min(60, selectedLayer.transform.width * 0.1));
                                const points = selectedLayer.points.map((item, pointIndex) => pointIndex !== index ? item : curved
                                  ? { ...item, in: undefined, out: undefined }
                                  : {
                                      ...item,
                                      in: { x: Math.max(0, item.x - handle), y: item.y },
                                      out: { x: Math.min(selectedLayer.transform.width, item.x + handle), y: item.y },
                                    });
                                patchSelectedLayer({ points } as Partial<PhoenixMediaLayer>);
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
                                            const points = selectedLayer.points.map((item, pointIndex) => pointIndex === index
                                              ? { ...item, [handleKey]: { ...(item[handleKey] || { x: item.x, y: item.y }), [axis]: value } }
                                              : item);
                                            patchSelectedLayer({ points } as Partial<PhoenixMediaLayer>);
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
                      <input type="color" value={selectedLayer.fill} onChange={event => patchSelectedLayer({ fill: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Stroke
                      <input type="color" value={selectedLayer.stroke} onChange={event => patchSelectedLayer({ stroke: event.target.value } as Partial<PhoenixMediaLayer>)} className="mt-1 h-10 w-full rounded border border-white/10 bg-black/20 p-1" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase text-slate-500">Stroke px
                      <input type="number" min={0} max={100} value={selectedLayer.strokeWidth} onChange={event => patchSelectedLayer({ strokeWidth: Math.max(0, Number(event.target.value)) } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                    </label>
                    <Button size="sm" variant={selectedLayer.closed ? 'gold' : 'ghost'} className="mt-5" onClick={() => patchSelectedLayer({ closed: !selectedLayer.closed } as Partial<PhoenixMediaLayer>)}>
                      {selectedLayer.closed ? 'Closed Path' : 'Open Path'}
                    </Button>
                  </div>
                </div>
              )}

              {!selectedLayer.symbolId && selectedLayer.type === 'path' && (
                <CompoundContourPanel
                  layer={selectedLayer}
                  onChange={patch => patchSelectedLayer(patch as Partial<PhoenixMediaLayer>)}
                />
              )}

              {!selectedLayer.symbolId && (selectedLayer.type === 'shape' || selectedLayer.type === 'path') && (
                <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-300">Gradient Fill</span>
                    <Button
                      size="sm"
                      variant={selectedLayer.gradient ? 'gold' : 'ghost'}
                      onClick={() => patchSelectedLayer({
                        gradient: selectedLayer.gradient ? undefined : {
                          kind: 'linear',
                          angle: 90,
                          start: selectedLayer.fill,
                          end: '#111827',
                        },
                      } as Partial<PhoenixMediaLayer>)}
                    >
                      {selectedLayer.gradient ? 'On' : 'Enable'}
                    </Button>
                  </div>
                  {selectedLayer.gradient && (
                    <div className="mt-3 space-y-2">
                      <select
                        value={selectedLayer.gradient.kind}
                        onChange={event => patchSelectedLayer({
                          gradient: { ...selectedLayer.gradient!, kind: event.target.value as 'linear' | 'radial' },
                        } as Partial<PhoenixMediaLayer>)}
                        className="min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white"
                      >
                        <option value="linear">Linear</option>
                        <option value="radial">Radial</option>
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] uppercase text-slate-500">Start
                          <input type="color" value={selectedLayer.gradient.start} onChange={event => patchSelectedLayer({ gradient: { ...selectedLayer.gradient!, start: event.target.value } } as Partial<PhoenixMediaLayer>)} className="mt-1 h-9 w-full" />
                        </label>
                        <label className="text-[10px] uppercase text-slate-500">End
                          <input type="color" value={selectedLayer.gradient.end} onChange={event => patchSelectedLayer({ gradient: { ...selectedLayer.gradient!, end: event.target.value } } as Partial<PhoenixMediaLayer>)} className="mt-1 h-9 w-full" />
                        </label>
                      </div>
                      {selectedLayer.gradient.kind === 'linear' && (
                        <label className="block text-[10px] uppercase text-slate-500">Angle
                          <input type="number" min={-360} max={360} value={selectedLayer.gradient.angle} onChange={event => patchSelectedLayer({ gradient: { ...selectedLayer.gradient!, angle: Number(event.target.value) } } as Partial<PhoenixMediaLayer>)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <LayerAlignmentPanel
                transform={selectedLayer.transform}
                document={document}
                onCommit={commitSelectedTransform}
              />

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
                  <option value="darken">Darken</option>
                  <option value="lighten">Lighten</option>
                  <option value="color-dodge">Color Dodge</option>
                  <option value="color-burn">Color Burn</option>
                  <option value="hard-light">Hard Light</option>
                  <option value="soft-light">Soft Light</option>
                  <option value="difference">Difference</option>
                  <option value="exclusion">Exclusion</option>
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
                    ['invert', 'Invert', 0, 100],
                    ['hueRotate', 'Hue', -180, 180],
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

              <VectorMaskPanel
                layer={selectedLayer}
                onChange={patch => patchSelectedLayer(patch)}
              />

              {selectedLayer.type !== 'adjustment' && (
                <LayerShadowPanel
                  layer={selectedLayer}
                  onChange={patch => patchSelectedLayer(patch)}
                />
              )}

              {selectedLayer.mask && (
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Editable Layer Mask</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['x', 'y', 'width', 'height'] as const).map(key => (
                      <label key={key} className="text-[10px] uppercase text-slate-500">{key}
                        <input
                          type="number"
                          min={key === 'width' || key === 'height' ? 1 : 0}
                          value={Math.round(selectedLayer.mask?.[key] || 0)}
                          onChange={event => {
                            if (!selectedLayer.mask) return;
                            const value = Number(event.target.value);
                            const nextMask = { ...selectedLayer.mask, [key]: Math.max(key === 'width' || key === 'height' ? 1 : 0, value) };
                            nextMask.x = Math.min(nextMask.x, selectedLayer.transform.width - 1);
                            nextMask.y = Math.min(nextMask.y, selectedLayer.transform.height - 1);
                            nextMask.width = Math.min(nextMask.width, selectedLayer.transform.width - nextMask.x);
                            nextMask.height = Math.min(nextMask.height, selectedLayer.transform.height - nextMask.y);
                            patchSelectedLayer({ mask: nextMask } as Partial<PhoenixMediaLayer>);
                          }}
                          className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white"
                        />
                      </label>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="mt-3 w-full" onClick={() => patchSelectedLayer({ mask: undefined })}>
                    Clear Mask
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" onClick={duplicateSelectedLayer}>Duplicate</Button>
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
