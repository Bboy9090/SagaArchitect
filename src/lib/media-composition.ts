export type PhoenixMediaDocumentKind =
  | 'image'
  | 'design'
  | 'illustration'
  | 'comic_page'
  | 'video_frame';

export type PhoenixBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';
export type PhoenixLayerType = 'text' | 'shape' | 'image' | 'raster' | 'path';

export interface PhoenixLayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PhoenixLayerAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
  sepia: number;
  invert: number;
  hueRotate: number;
  blur: number;
}

export interface PhoenixLayerMask {
  x: number;
  y: number;
  width: number;
  height: number;
  inverted?: boolean;
}

export interface PhoenixBaseLayer {
  id: string;
  type: PhoenixLayerType;
  groupId?: string;
  symbolId?: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: PhoenixBlendMode;
  zIndex: number;
  transform: PhoenixLayerTransform;
  mask?: PhoenixLayerMask;
  adjustments?: PhoenixLayerAdjustments;
}

export interface PhoenixTextLayer extends PhoenixBaseLayer {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  italic?: boolean;
  underline?: boolean;
}

export interface PhoenixGradientFill {
  kind: 'linear' | 'radial';
  angle: number;
  start: string;
  end: string;
}

export interface PhoenixShapeLayer extends PhoenixBaseLayer {
  type: 'shape';
  shape: 'rectangle' | 'ellipse';
  fill: string;
  gradient?: PhoenixGradientFill;
  stroke: string;
  strokeWidth: number;
}

export interface PhoenixImageLayer extends PhoenixBaseLayer {
  type: 'image';
  assetId?: string;
  src: string;
  fit: 'cover' | 'contain' | 'fill';
}

export interface PhoenixRasterLayer extends PhoenixBaseLayer {
  type: 'raster';
  src: string;
}

export interface PhoenixVectorHandle {
  x: number;
  y: number;
}

export interface PhoenixVectorPoint {
  x: number;
  y: number;
  in?: PhoenixVectorHandle;
  out?: PhoenixVectorHandle;
}

export interface PhoenixVectorContour {
  id: string;
  points: PhoenixVectorPoint[];
  closed: boolean;
}

export interface PhoenixPathLayer extends PhoenixBaseLayer {
  type: 'path';
  points: PhoenixVectorPoint[];
  closed: boolean;
  contours?: PhoenixVectorContour[];
  fillRule?: 'nonzero' | 'evenodd';
  fill: string;
  gradient?: PhoenixGradientFill;
  stroke: string;
  strokeWidth: number;
}

export type PhoenixMediaLayer =
  | PhoenixTextLayer
  | PhoenixShapeLayer
  | PhoenixImageLayer
  | PhoenixRasterLayer
  | PhoenixPathLayer;

export interface PhoenixLayerGroup {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface PhoenixSymbolDefinition {
  id: string;
  name: string;
  masterLayerId: string;
}

export interface PhoenixMediaDocument {
  id: string;
  projectId: string;
  kind: PhoenixMediaDocumentKind;
  title: string;
  width: number;
  height: number;
  background: string;
  layers: PhoenixMediaLayer[];
  groups?: PhoenixLayerGroup[];
  symbols?: PhoenixSymbolDefinition[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'phoenix_media_document:';

export function createPhoenixMediaDocument(
  projectId: string,
  kind: PhoenixMediaDocumentKind = 'image',
): PhoenixMediaDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    kind,
    title: kind === 'image' ? 'Untitled Image' : 'Untitled Composition',
    width: 1200,
    height: 1200,
    background: '#111827',
    layers: [],
    groups: [],
    symbols: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function mediaDocumentStorageKey(projectId: string, kind: PhoenixMediaDocumentKind): string {
  return `${STORAGE_PREFIX}${projectId}:${kind}`;
}

export function loadPhoenixMediaDocument(
  projectId: string,
  kind: PhoenixMediaDocumentKind = 'image',
): PhoenixMediaDocument | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(mediaDocumentStorageKey(projectId, kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhoenixMediaDocument;
    if (!parsed || parsed.projectId !== projectId || parsed.kind !== kind || !Array.isArray(parsed.layers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePhoenixMediaDocument(document: PhoenixMediaDocument): PhoenixMediaDocument {
  const saved = {
    ...document,
    version: Math.max(1, document.version || 1),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(mediaDocumentStorageKey(saved.projectId, saved.kind), JSON.stringify(saved));
  }
  return saved;
}

export function nextLayerZIndex(layers: PhoenixMediaLayer[]): number {
  return layers.reduce((max, layer) => Math.max(max, layer.zIndex), 0) + 1;
}

export function clampLayerTransform(
  transform: PhoenixLayerTransform,
  document: Pick<PhoenixMediaDocument, 'width' | 'height'>,
): PhoenixLayerTransform {
  const width = Math.max(1, Math.min(transform.width, document.width));
  const height = Math.max(1, Math.min(transform.height, document.height));
  return {
    ...transform,
    width,
    height,
    x: Math.max(0, Math.min(transform.x, Math.max(0, document.width - width))),
    y: Math.max(0, Math.min(transform.y, Math.max(0, document.height - height))),
    rotation: Number.isFinite(transform.rotation) ? transform.rotation : 0,
  };
}


export const DEFAULT_LAYER_ADJUSTMENTS: PhoenixLayerAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  hueRotate: 0,
  blur: 0,
};

export function normalizeLayerAdjustments(layer: Pick<PhoenixBaseLayer, 'adjustments'>): PhoenixLayerAdjustments {
  return { ...DEFAULT_LAYER_ADJUSTMENTS, ...(layer.adjustments || {}) };
}

export function layerCssFilter(layer: Pick<PhoenixBaseLayer, 'adjustments'>): string {
  const a = normalizeLayerAdjustments(layer);
  return [
    `brightness(${Math.max(0, a.brightness)}%)`,
    `contrast(${Math.max(0, a.contrast)}%)`,
    `saturate(${Math.max(0, a.saturation)}%)`,
    `grayscale(${Math.max(0, Math.min(100, a.grayscale))}%)`,
    `sepia(${Math.max(0, Math.min(100, a.sepia))}%)`,
    `invert(${Math.max(0, Math.min(100, a.invert))}%)`,
    `hue-rotate(${Math.max(-180, Math.min(180, a.hueRotate))}deg)`,
    `blur(${Math.max(0, a.blur)}px)`,
  ].join(' ');
}


function vectorSegmentCommand(from: PhoenixVectorPoint, to: PhoenixVectorPoint): string {
  if (from.out || to.in) {
    const out = from.out || { x: from.x, y: from.y };
    const incoming = to.in || { x: to.x, y: to.y };
    return `C ${out.x} ${out.y} ${incoming.x} ${incoming.y} ${to.x} ${to.y}`;
  }
  return `L ${to.x} ${to.y}`;
}

function vectorContourSvgD(points: PhoenixVectorPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const commands = [`M ${first.x} ${first.y}`];
  let previous = first;
  for (const point of rest) {
    commands.push(vectorSegmentCommand(previous, point));
    previous = point;
  }
  if (closed && points.length > 1) {
    commands.push(vectorSegmentCommand(previous, first));
    commands.push('Z');
  }
  return commands.join(' ');
}

export function vectorPathSvgD(
  layer: Pick<PhoenixPathLayer, 'points' | 'closed' | 'contours'>,
): string {
  return [
    vectorContourSvgD(layer.points, layer.closed),
    ...(layer.contours || []).map(contour => vectorContourSvgD(contour.points, contour.closed)),
  ].filter(Boolean).join(' ');
}


export function moveVectorPoint(point: PhoenixVectorPoint, x: number, y: number): PhoenixVectorPoint {
  const dx = x - point.x;
  const dy = y - point.y;
  return {
    ...point,
    x,
    y,
    in: point.in ? { x: point.in.x + dx, y: point.in.y + dy } : undefined,
    out: point.out ? { x: point.out.x + dx, y: point.out.y + dy } : undefined,
  };
}

export function scaleVectorPoints(points: PhoenixVectorPoint[], scaleX: number, scaleY: number): PhoenixVectorPoint[] {
  return points.map(point => ({
    ...point,
    x: point.x * scaleX,
    y: point.y * scaleY,
    in: point.in ? { x: point.in.x * scaleX, y: point.in.y * scaleY } : undefined,
    out: point.out ? { x: point.out.x * scaleX, y: point.out.y * scaleY } : undefined,
  }));
}


export function gradientFillCss(gradient: PhoenixGradientFill | undefined, fallback: string): string {
  if (!gradient) return fallback;
  const start = gradient.start || fallback;
  const end = gradient.end || fallback;
  return gradient.kind === 'radial'
    ? `radial-gradient(circle at center, ${start} 0%, ${end} 100%)`
    : `linear-gradient(${Number.isFinite(gradient.angle) ? gradient.angle : 0}deg, ${start} 0%, ${end} 100%)`;
}


export function layerGroupFor(
  document: Pick<PhoenixMediaDocument, 'groups'>,
  layer: Pick<PhoenixBaseLayer, 'groupId'>,
): PhoenixLayerGroup | undefined {
  if (!layer.groupId) return undefined;
  return (document.groups || []).find(group => group.id === layer.groupId);
}

export function effectiveLayerOpacity(
  layer: Pick<PhoenixBaseLayer, 'opacity' | 'groupId'>,
  document: Pick<PhoenixMediaDocument, 'groups'>,
): number {
  const group = layerGroupFor(document, layer);
  return Math.max(0, Math.min(1, layer.opacity * (group?.opacity ?? 1)));
}

export function isLayerEffectivelyVisible(
  layer: Pick<PhoenixBaseLayer, 'visible' | 'groupId'>,
  document: Pick<PhoenixMediaDocument, 'groups'>,
): boolean {
  const group = layerGroupFor(document, layer);
  return layer.visible && (group?.visible ?? true);
}

export function isLayerEffectivelyLocked(
  layer: Pick<PhoenixBaseLayer, 'locked' | 'groupId'>,
  document: Pick<PhoenixMediaDocument, 'groups'>,
): boolean {
  const group = layerGroupFor(document, layer);
  return layer.locked || (group?.locked ?? false);
}


export function vectorPathFillRule(layer: Pick<PhoenixPathLayer, 'fillRule' | 'contours'>): CanvasFillRule {
  return layer.fillRule || ((layer.contours?.length || 0) > 0 ? 'evenodd' : 'nonzero');
}

export function scaleVectorContours(
  contours: PhoenixVectorContour[] | undefined,
  scaleX: number,
  scaleY: number,
): PhoenixVectorContour[] | undefined {
  return contours?.map(contour => ({
    ...contour,
    points: scaleVectorPoints(contour.points, scaleX, scaleY),
  }));
}


export function textLineHeight(layer: Pick<PhoenixTextLayer, 'fontSize' | 'lineHeight'>): number {
  return layer.fontSize * Math.max(0.5, Math.min(4, layer.lineHeight ?? 1.08));
}

export function textLetterSpacing(layer: Pick<PhoenixTextLayer, 'letterSpacing'>): number {
  return Math.max(-20, Math.min(200, layer.letterSpacing ?? 0));
}


function instanceBaseFields(layer: PhoenixMediaLayer) {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    zIndex: layer.zIndex,
    transform: { ...layer.transform },
    groupId: layer.groupId,
    mask: layer.mask ? { ...layer.mask } : undefined,
    adjustments: layer.adjustments ? { ...layer.adjustments } : undefined,
    symbolId: layer.symbolId,
  };
}

export function symbolDefinitionForLayer(
  document: Pick<PhoenixMediaDocument, 'symbols'>,
  layer: Pick<PhoenixBaseLayer, 'symbolId'>,
): PhoenixSymbolDefinition | undefined {
  if (!layer.symbolId) return undefined;
  return (document.symbols || []).find(symbol => symbol.id === layer.symbolId);
}

export function symbolDefinitionForMaster(
  document: Pick<PhoenixMediaDocument, 'symbols'>,
  layerId: string,
): PhoenixSymbolDefinition | undefined {
  return (document.symbols || []).find(symbol => symbol.masterLayerId === layerId);
}

export function resolveSymbolLayer(
  document: Pick<PhoenixMediaDocument, 'layers' | 'symbols'>,
  layer: PhoenixMediaLayer,
): PhoenixMediaLayer {
  const symbol = symbolDefinitionForLayer(document, layer);
  if (!symbol) return layer;
  const master = document.layers.find(candidate => candidate.id === symbol.masterLayerId && !candidate.symbolId);
  if (!master || master.type !== layer.type) return layer;
  return {
    ...master,
    ...instanceBaseFields(layer),
  } as PhoenixMediaLayer;
}

export function createSymbolInstance(
  document: Pick<PhoenixMediaDocument, 'layers' | 'symbols'>,
  symbolId: string,
  zIndex: number,
): PhoenixMediaLayer | null {
  const symbol = (document.symbols || []).find(candidate => candidate.id === symbolId);
  if (!symbol) return null;
  const master = document.layers.find(layer => layer.id === symbol.masterLayerId && !layer.symbolId);
  if (!master) return null;
  const offset = 32;
  return {
    ...structuredClone(master),
    id: crypto.randomUUID(),
    name: `${symbol.name} instance`,
    zIndex,
    transform: {
      ...master.transform,
      x: master.transform.x + offset,
      y: master.transform.y + offset,
    },
    symbolId,
  } as PhoenixMediaLayer;
}

export function detachSymbolInstance(
  document: Pick<PhoenixMediaDocument, 'layers' | 'symbols'>,
  layer: PhoenixMediaLayer,
): PhoenixMediaLayer {
  const resolved = resolveSymbolLayer(document, layer);
  return { ...structuredClone(resolved), id: layer.id, symbolId: undefined } as PhoenixMediaLayer;
}

export function removeLayerPreservingSymbols(
  document: PhoenixMediaDocument,
  layerId: string,
): PhoenixMediaDocument {
  const masteredSymbols = (document.symbols || []).filter(symbol => symbol.masterLayerId === layerId);
  if (masteredSymbols.length === 0) {
    return { ...document, layers: document.layers.filter(layer => layer.id !== layerId) };
  }
  const masteredIds = new Set(masteredSymbols.map(symbol => symbol.id));
  const layers = document.layers
    .filter(layer => layer.id !== layerId)
    .map(layer => masteredIds.has(layer.symbolId || '')
      ? detachSymbolInstance(document, layer)
      : layer);
  return {
    ...document,
    layers,
    symbols: (document.symbols || []).filter(symbol => !masteredIds.has(symbol.id)),
  };
}
