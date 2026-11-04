export type PhoenixComicPageDocumentKind = 'comic_page' | `comic_page:${string}`;

export type PhoenixMediaDocumentKind =
  | 'image'
  | 'design'
  | 'illustration'
  | PhoenixComicPageDocumentKind
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
export type PhoenixLayerType = 'text' | 'shape' | 'image' | 'raster' | 'path' | 'adjustment';

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

export interface PhoenixLayerShadow {
  color: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface PhoenixBaseLayer {
  id: string;
  type: PhoenixLayerType;
  groupId?: string;
  panelId?: string;
  symbolId?: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: PhoenixBlendMode;
  zIndex: number;
  transform: PhoenixLayerTransform;
  mask?: PhoenixLayerMask;
  vectorMask?: PhoenixVectorMask;
  shadow?: PhoenixLayerShadow;
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

export interface PhoenixAdjustmentLayer extends PhoenixBaseLayer {
  type: 'adjustment';
  adjustments: PhoenixLayerAdjustments;
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

export interface PhoenixVectorMask {
  points: PhoenixVectorPoint[];
}

export interface PhoenixVectorContour {
  id: string;
  points: PhoenixVectorPoint[];
  closed: boolean;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
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
  | PhoenixPathLayer
  | PhoenixAdjustmentLayer;

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
  pageOrder?: number;
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

export function isComicPageDocumentKind(kind: string): kind is PhoenixComicPageDocumentKind {
  return kind === 'comic_page' || /^comic_page:[A-Za-z0-9_-]{1,64}$/.test(kind);
}

export function listPhoenixMediaDocuments(
  projectId: string,
  prefix: 'comic_page',
): PhoenixMediaDocument[] {
  if (typeof window === 'undefined') return [];
  const storagePrefix = `${STORAGE_PREFIX}${projectId}:${prefix}`;
  const documents: PhoenixMediaDocument[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(storagePrefix)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '') as PhoenixMediaDocument;
      if (parsed?.projectId === projectId && isComicPageDocumentKind(parsed.kind) && Array.isArray(parsed.layers)) {
        documents.push(parsed);
      }
    } catch {
      // Ignore malformed local documents rather than blocking the rest of the issue.
    }
  }
  return documents.sort((a, b) =>
    (a.pageOrder ?? Number.MAX_SAFE_INTEGER) - (b.pageOrder ?? Number.MAX_SAFE_INTEGER)
    || a.createdAt.localeCompare(b.createdAt)
  );
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

export function vectorContourSvgD(points: PhoenixVectorPoint[], closed: boolean): string {
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

export function vectorPathFillSvgD(
  layer: Pick<PhoenixPathLayer, 'points' | 'closed' | 'contours'>,
): string {
  return [
    layer.closed ? vectorContourSvgD(layer.points, true) : '',
    ...(layer.contours || [])
      .filter(contour => contour.closed)
      .map(contour => vectorContourSvgD(contour.points, true)),
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
    panelId: layer.panelId,
    mask: layer.mask ? { ...layer.mask } : undefined,
    vectorMask: layer.vectorMask ? { points: structuredClone(layer.vectorMask.points) } : undefined,
    shadow: layer.shadow ? { ...layer.shadow } : undefined,
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
  const resolved = {
    ...master,
    ...instanceBaseFields(layer),
  } as PhoenixMediaLayer;
  if (master.type === 'path' && resolved.type === 'path') {
    const scaleX = master.transform.width > 0 ? resolved.transform.width / master.transform.width : 1;
    const scaleY = master.transform.height > 0 ? resolved.transform.height / master.transform.height : 1;
    resolved.points = scaleVectorPoints(master.points, scaleX, scaleY);
    resolved.contours = scaleVectorContours(master.contours, scaleX, scaleY);
  }
  return resolved;
}

export function createSymbolInstance(
  document: Pick<PhoenixMediaDocument, 'layers' | 'symbols' | 'width' | 'height'>,
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
    transform: clampLayerTransform({
      ...master.transform,
      x: master.transform.x + offset,
      y: master.transform.y + offset,
    }, document),
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


export function vectorMaskCssClipPath(
  layer: Pick<PhoenixBaseLayer, 'vectorMask' | 'transform'>,
): string | undefined {
  if (!layer.vectorMask || layer.vectorMask.points.length < 3) return undefined;
  const width = Math.max(1, layer.transform.width);
  const height = Math.max(1, layer.transform.height);
  const points = layer.vectorMask.points
    .map(point => {
      const x = Math.max(0, Math.min(100, (point.x / width) * 100));
      const y = Math.max(0, Math.min(100, (point.y / height) * 100));
      return `${x}% ${y}%`;
    })
    .join(', ');
  return `polygon(${points})`;
}

export function scaleVectorMask(
  mask: PhoenixVectorMask | undefined,
  scaleX: number,
  scaleY: number,
): PhoenixVectorMask | undefined {
  if (!mask) return undefined;
  return {
    points: scaleVectorPoints(mask.points, scaleX, scaleY),
  };
}

export function defaultVectorMask(
  width: number,
  height: number,
  inset = 0.08,
): PhoenixVectorMask {
  const x = Math.max(0, width * inset);
  const y = Math.max(0, height * inset);
  const right = Math.max(x + 1, width - x);
  const bottom = Math.max(y + 1, height - y);
  return {
    points: [
      { x, y },
      { x: right, y },
      { x: right, y: bottom },
      { x, y: bottom },
    ],
  };
}


function normalizedHexColor(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return '#000000';
}

export function shadowCssColor(shadow: PhoenixLayerShadow): string {
  const hex = normalizedHexColor(shadow.color);
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const alpha = Math.max(0, Math.min(1, shadow.opacity));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function layerCssEffects(
  layer: Pick<PhoenixBaseLayer, 'adjustments' | 'shadow'>,
): string {
  const filters = [layerCssFilter(layer)];
  if (layer.shadow) {
    filters.push(
      `drop-shadow(${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${Math.max(0, layer.shadow.blur)}px ${shadowCssColor(layer.shadow)})`,
    );
  }
  return filters.join(' ');
}


const PHOENIX_MEDIA_FILE_FORMAT = 'phoenix-media-document';
const PHOENIX_MEDIA_FILE_VERSION = 1;

export interface PhoenixMediaDocumentFile {
  format: typeof PHOENIX_MEDIA_FILE_FORMAT;
  fileVersion: number;
  exportedAt: string;
  document: PhoenixMediaDocument;
}

export function createPhoenixMediaDocumentFile(document: PhoenixMediaDocument): PhoenixMediaDocumentFile {
  return {
    format: PHOENIX_MEDIA_FILE_FORMAT,
    fileVersion: PHOENIX_MEDIA_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    document: structuredClone(document),
  };
}

function isFiniteBoundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isPhoenixLayerType(value: unknown): value is PhoenixLayerType {
  return value === 'text' || value === 'shape' || value === 'image' || value === 'raster' || value === 'path' || value === 'adjustment';
}

export function parsePhoenixMediaDocumentFile(
  raw: string,
  targetProjectId: string,
  expectedKind: PhoenixMediaDocumentKind,
  targetVersion: number,
): PhoenixMediaDocument {
  if (raw.length > 12 * 1024 * 1024) throw new Error('Phoenix document exceeds the 12 MB editor limit.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid Phoenix document JSON.');
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid Phoenix document file.');
  const wrapper = parsed as Partial<PhoenixMediaDocumentFile>;
  if (wrapper.format !== PHOENIX_MEDIA_FILE_FORMAT || wrapper.fileVersion !== PHOENIX_MEDIA_FILE_VERSION) {
    throw new Error('Unsupported Phoenix document format or version.');
  }
  const document = wrapper.document;
  if (!document || typeof document !== 'object') throw new Error('Phoenix document payload is missing.');
  if (document.kind !== expectedKind) {
    throw new Error(`This is a ${document.kind || 'different'} document, not a ${expectedKind} document.`);
  }
  if (!isFiniteBoundedNumber(document.width, 1, 16384) || !isFiniteBoundedNumber(document.height, 1, 16384)) {
    throw new Error('Phoenix document canvas dimensions are invalid.');
  }
  if (!Array.isArray(document.layers) || document.layers.length > 500) {
    throw new Error('Phoenix document layer count is invalid.');
  }
  for (const layer of document.layers) {
    if (!layer || typeof layer !== 'object' || !isPhoenixLayerType(layer.type)) {
      throw new Error('Phoenix document contains an unsupported layer.');
    }
    if (!layer.transform
      || !isFiniteBoundedNumber(layer.transform.width, 1, 16384)
      || !isFiniteBoundedNumber(layer.transform.height, 1, 16384)
      || typeof layer.transform.x !== 'number'
      || typeof layer.transform.y !== 'number'
      || typeof layer.transform.rotation !== 'number') {
      throw new Error('Phoenix document contains invalid layer geometry.');
    }
  }
  if (document.groups && (!Array.isArray(document.groups) || document.groups.length > 200)) {
    throw new Error('Phoenix document group data is invalid.');
  }
  if (document.symbols && (!Array.isArray(document.symbols) || document.symbols.length > 200)) {
    throw new Error('Phoenix document symbol data is invalid.');
  }

  const now = new Date().toISOString();
  return {
    ...structuredClone(document),
    id: crypto.randomUUID(),
    projectId: targetProjectId,
    kind: expectedKind,
    groups: Array.isArray(document.groups) ? document.groups : [],
    symbols: Array.isArray(document.symbols) ? document.symbols : [],
    version: Math.max(1, targetVersion || 1),
    createdAt: now,
    updatedAt: now,
  };
}

export function phoenixMediaDocumentFileName(document: Pick<PhoenixMediaDocument, 'title' | 'kind'>): string {
  const safeTitle = document.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  return `${safeTitle}.${document.kind}.phoenix.json`;
}


export type PhoenixLayerAlignment =
  | 'left'
  | 'center-x'
  | 'right'
  | 'top'
  | 'center-y'
  | 'bottom';

export function alignLayerToCanvas(
  transform: PhoenixLayerTransform,
  document: Pick<PhoenixMediaDocument, 'width' | 'height'>,
  alignment: PhoenixLayerAlignment,
): PhoenixLayerTransform {
  const next = { ...transform };
  if (alignment === 'left') next.x = 0;
  if (alignment === 'center-x') next.x = (document.width - transform.width) / 2;
  if (alignment === 'right') next.x = document.width - transform.width;
  if (alignment === 'top') next.y = 0;
  if (alignment === 'center-y') next.y = (document.height - transform.height) / 2;
  if (alignment === 'bottom') next.y = document.height - transform.height;
  return clampLayerTransform(next, document);
}

export function rotateLayerBy(
  transform: PhoenixLayerTransform,
  degrees: number,
): PhoenixLayerTransform {
  return {
    ...transform,
    rotation: ((transform.rotation + degrees) % 360 + 360) % 360,
  };
}


export function createAdjustmentLayer(
  document: Pick<PhoenixMediaDocument, 'width' | 'height' | 'layers'>,
): PhoenixAdjustmentLayer {
  return {
    id: crypto.randomUUID(),
    type: 'adjustment',
    name: 'Adjustment Layer',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    zIndex: nextLayerZIndex(document.layers),
    transform: { x: 0, y: 0, width: document.width, height: document.height, rotation: 0 },
    adjustments: { ...DEFAULT_LAYER_ADJUSTMENTS },
  };
}


export type PhoenixSelectionAlignment =
  | 'left'
  | 'center-x'
  | 'right'
  | 'top'
  | 'center-y'
  | 'bottom';

export function alignLayerTransformsToSelection(
  layers: Pick<PhoenixMediaLayer, 'id' | 'transform'>[],
  alignment: PhoenixSelectionAlignment,
): Map<string, PhoenixLayerTransform> {
  const result = new Map<string, PhoenixLayerTransform>();
  if (layers.length < 2) return result;

  const left = Math.min(...layers.map(layer => layer.transform.x));
  const top = Math.min(...layers.map(layer => layer.transform.y));
  const right = Math.max(...layers.map(layer => layer.transform.x + layer.transform.width));
  const bottom = Math.max(...layers.map(layer => layer.transform.y + layer.transform.height));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  for (const layer of layers) {
    const next = { ...layer.transform };
    if (alignment === 'left') next.x = left;
    if (alignment === 'center-x') next.x = centerX - next.width / 2;
    if (alignment === 'right') next.x = right - next.width;
    if (alignment === 'top') next.y = top;
    if (alignment === 'center-y') next.y = centerY - next.height / 2;
    if (alignment === 'bottom') next.y = bottom - next.height;
    result.set(layer.id, next);
  }
  return result;
}

export function distributeLayerTransforms(
  layers: Pick<PhoenixMediaLayer, 'id' | 'transform'>[],
  axis: 'horizontal' | 'vertical',
): Map<string, PhoenixLayerTransform> {
  const result = new Map<string, PhoenixLayerTransform>();
  if (layers.length < 3) return result;

  const ordered = [...layers].sort((a, b) => axis === 'horizontal'
    ? a.transform.x - b.transform.x
    : a.transform.y - b.transform.y);

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const firstCenter = axis === 'horizontal'
    ? first.transform.x + first.transform.width / 2
    : first.transform.y + first.transform.height / 2;
  const lastCenter = axis === 'horizontal'
    ? last.transform.x + last.transform.width / 2
    : last.transform.y + last.transform.height / 2;
  const step = (lastCenter - firstCenter) / (ordered.length - 1);

  ordered.forEach((layer, index) => {
    const targetCenter = firstCenter + step * index;
    result.set(layer.id, {
      ...layer.transform,
      x: axis === 'horizontal' ? targetCenter - layer.transform.width / 2 : layer.transform.x,
      y: axis === 'vertical' ? targetCenter - layer.transform.height / 2 : layer.transform.y,
    });
  });
  return result;
}
