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

export interface PhoenixPathLayer extends PhoenixBaseLayer {
  type: 'path';
  points: PhoenixVectorPoint[];
  closed: boolean;
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

export interface PhoenixMediaDocument {
  id: string;
  projectId: string;
  kind: PhoenixMediaDocumentKind;
  title: string;
  width: number;
  height: number;
  background: string;
  layers: PhoenixMediaLayer[];
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

export function vectorPathSvgD(layer: Pick<PhoenixPathLayer, 'points' | 'closed'>): string {
  if (layer.points.length === 0) return '';
  const [first, ...rest] = layer.points;
  const commands = [`M ${first.x} ${first.y}`];
  let previous = first;
  for (const point of rest) {
    commands.push(vectorSegmentCommand(previous, point));
    previous = point;
  }
  if (layer.closed && layer.points.length > 1) {
    commands.push(vectorSegmentCommand(previous, first));
    commands.push('Z');
  }
  return commands.join(' ');
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
