import {
  effectiveLayerOpacity,
  isLayerEffectivelyVisible,
  layerCssFilter,
  resolveSymbolLayer,
  textLetterSpacing,
  textLineHeight,
  vectorPathFillRule,
  type PhoenixImageLayer,
  type PhoenixMediaDocument,
  type PhoenixMediaLayer,
} from './media-composition';

export type PhoenixRasterExportFormat = 'png' | 'jpeg' | 'webp';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load media layer image.'));
    image.src = src;
  });
}

function canvasFor(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function applyCommonLayerState(
  ctx: CanvasRenderingContext2D,
  layer: PhoenixMediaLayer,
  documentModel: PhoenixMediaDocument,
) {
  ctx.globalAlpha = effectiveLayerOpacity(layer, documentModel);
  ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;
}

function layerFillStyle(
  ctx: CanvasRenderingContext2D,
  layer: Extract<PhoenixMediaLayer, { type: 'shape' | 'path' }>,
  width: number,
  height: number,
): string | CanvasGradient {
  if (!layer.gradient) return layer.fill;
  if (layer.gradient.kind === 'radial') {
    const radius = Math.max(width, height) / 2;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    gradient.addColorStop(0, layer.gradient.start);
    gradient.addColorStop(1, layer.gradient.end);
    return gradient;
  }
  const angle = Number.isFinite(layer.gradient.angle) ? layer.gradient.angle : 0;
  const radians = (angle * Math.PI) / 180;
  const radius = Math.sqrt(width * width + height * height) / 2;
  const dx = Math.sin(radians) * radius;
  const dy = -Math.cos(radians) * radius;
  const gradient = ctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
  gradient.addColorStop(0, layer.gradient.start);
  gradient.addColorStop(1, layer.gradient.end);
  return gradient;
}

function imageRect(
  layer: PhoenixImageLayer,
  image: HTMLImageElement,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const width = layer.transform.width;
  const height = layer.transform.height;

  if (layer.fit === 'fill') {
    return { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight, dx: 0, dy: 0, dw: width, dh: height };
  }

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;

  if (layer.fit === 'contain') {
    let dw = width;
    let dh = width / sourceRatio;
    if (dh > height) {
      dh = height;
      dw = height * sourceRatio;
    }
    return {
      sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight,
      dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh,
    };
  }

  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: width, dh: height };
}

async function renderLayerBitmap(layer: PhoenixMediaLayer): Promise<HTMLCanvasElement> {
  const width = Math.max(1, Math.round(layer.transform.width));
  const height = Math.max(1, Math.round(layer.transform.height));
  const canvas = canvasFor(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  ctx.filter = layerCssFilter(layer);

  if (layer.type === 'shape') {
    ctx.fillStyle = layerFillStyle(ctx, layer, width, height);
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = Math.max(0, layer.strokeWidth);
    if (layer.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (layer.strokeWidth > 0) ctx.stroke();
    } else {
      ctx.fillRect(0, 0, width, height);
      if (layer.strokeWidth > 0) ctx.strokeRect(0, 0, width, height);
    }
  } else if (layer.type === 'path') {
    const traceContour = (points: typeof layer.points, closed: boolean) => {
      if (points.length === 0) return;
      const first = points[0];
      ctx.moveTo(first.x, first.y);
      let previous = first;
      for (const point of points.slice(1)) {
        if (previous.out || point.in) {
          const out = previous.out || { x: previous.x, y: previous.y };
          const incoming = point.in || { x: point.x, y: point.y };
          ctx.bezierCurveTo(out.x, out.y, incoming.x, incoming.y, point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
        previous = point;
      }
      if (closed && points.length > 1) {
        if (previous.out || first.in) {
          const out = previous.out || { x: previous.x, y: previous.y };
          const incoming = first.in || { x: first.x, y: first.y };
          ctx.bezierCurveTo(out.x, out.y, incoming.x, incoming.y, first.x, first.y);
        }
        ctx.closePath();
      }
    };

    if (layer.points.length > 0 || (layer.contours?.length || 0) > 0) {
      ctx.beginPath();
      traceContour(layer.points, layer.closed);
      for (const contour of layer.contours || []) traceContour(contour.points, contour.closed);
      if ((layer.closed || (layer.contours || []).some(contour => contour.closed)) && (layer.gradient || layer.fill !== 'transparent')) {
        ctx.fillStyle = layerFillStyle(ctx, layer, width, height);
        ctx.fill(vectorPathFillRule(layer));
      }
      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  } else if (layer.type === 'text') {
    ctx.fillStyle = layer.color;
    ctx.font = `${layer.italic ? 'italic ' : ''}${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
    ctx.textBaseline = 'top';
    const spacing = textLetterSpacing(layer);
    const lineHeight = textLineHeight(layer);
    const drawSpacedLine = (line: string, y: number) => {
      const glyphs = Array.from(line);
      const baseWidth = ctx.measureText(line).width;
      const totalWidth = baseWidth + Math.max(0, glyphs.length - 1) * spacing;
      const startX = layer.align === 'center' ? (width - totalWidth) / 2 : layer.align === 'right' ? width - totalWidth : 0;
      let cursor = startX;
      for (const glyph of glyphs) {
        ctx.fillText(glyph, cursor, y);
        cursor += ctx.measureText(glyph).width + spacing;
      }
      if (layer.underline && totalWidth > 0) {
        ctx.save();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = Math.max(1, layer.fontSize / 18);
        const underlineY = y + layer.fontSize * 1.02;
        ctx.beginPath();
        ctx.moveTo(startX, underlineY);
        ctx.lineTo(startX + totalWidth, underlineY);
        ctx.stroke();
        ctx.restore();
      }
    };
    layer.text.split(/\r?\n/).forEach((line, index) => drawSpacedLine(line, index * lineHeight));
  } else if (layer.type === 'image') {
    const image = await loadImage(layer.src);
    const r = imageRect(layer, image);
    ctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  } else if (layer.type === 'raster' && layer.src) {
    const image = await loadImage(layer.src);
    ctx.drawImage(image, 0, 0, width, height);
  }

  ctx.filter = 'none';

  if (layer.mask) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(layer.mask.x, layer.mask.y, layer.mask.width, layer.mask.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  return canvas;
}

export async function renderPhoenixMediaDocument(documentModel: PhoenixMediaDocument): Promise<HTMLCanvasElement> {
  const canvas = canvasFor(documentModel.width, documentModel.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  ctx.fillStyle = documentModel.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const layers = [...documentModel.layers]
    .filter(layer => isLayerEffectivelyVisible(layer, documentModel))
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of layers) {
    const resolvedLayer = resolveSymbolLayer(documentModel, layer);
    const bitmap = await renderLayerBitmap(resolvedLayer);
    const { x, y, width, height, rotation } = resolvedLayer.transform;
    ctx.save();
    applyCommonLayerState(ctx, resolvedLayer, documentModel);
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  return canvas;
}

export async function exportPhoenixMediaDocument(
  documentModel: PhoenixMediaDocument,
  format: PhoenixRasterExportFormat,
  quality = 0.92,
): Promise<Blob> {
  const canvas = await renderPhoenixMediaDocument(documentModel);
  const mime = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Failed to encode exported image.')),
      mime,
      format === 'png' ? undefined : Math.max(0.1, Math.min(1, quality)),
    );
  });
}

export function downloadMediaBlob(blob: Blob, title: string, format: PhoenixRasterExportFormat): void {
  const extension = format === 'jpeg' ? 'jpg' : format;
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phoenix-media';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
