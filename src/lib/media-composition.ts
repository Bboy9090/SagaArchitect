export type PhoenixMediaDocumentKind =
  | 'image'
  | 'design'
  | 'illustration'
  | 'comic_page'
  | 'video_frame';

export type PhoenixBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';
export type PhoenixLayerType = 'text' | 'shape' | 'image';

export interface PhoenixLayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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

export interface PhoenixShapeLayer extends PhoenixBaseLayer {
  type: 'shape';
  shape: 'rectangle' | 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface PhoenixImageLayer extends PhoenixBaseLayer {
  type: 'image';
  assetId?: string;
  src: string;
  fit: 'cover' | 'contain' | 'fill';
}

export type PhoenixMediaLayer = PhoenixTextLayer | PhoenixShapeLayer | PhoenixImageLayer;

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
