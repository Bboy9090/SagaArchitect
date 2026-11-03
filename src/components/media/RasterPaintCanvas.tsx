'use client';

import { useEffect, useRef } from 'react';
import type { PhoenixRasterLayer } from '@/lib/media-composition';

interface RasterPaintCanvasProps {
  layer: PhoenixRasterLayer;
  scale: number;
  selected: boolean;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  erase: boolean;
  onSelect: () => void;
  onCommit: (src: string) => void;
}

export function RasterPaintCanvas({
  layer,
  scale,
  selected,
  brushColor,
  brushSize,
  brushOpacity,
  erase,
  onSelect,
  onCommit,
}: RasterPaintCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(layer.transform.width));
    canvas.height = Math.max(1, Math.round(layer.transform.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!layer.src) return;
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = layer.src;
  }, [layer.src, layer.transform.width, layer.transform.height]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    onSelect();
    if (layer.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = point(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || layer.locked) return;
    const canvas = ref.current;
    const previous = last.current;
    if (!canvas || !previous) return;
    const next = point(event);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.5;
    ctx.save();
    ctx.globalAlpha = brushOpacity;
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = Math.max(1, brushSize * (0.5 + pressure));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.restore();
    last.current = next;
  };

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    const canvas = ref.current;
    if (canvas) onCommit(canvas.toDataURL('image/png'));
  };

  return (
    <canvas
      ref={ref}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={`Paint layer ${layer.name}`}
      className="block touch-none"
      style={{
        width: layer.transform.width * scale,
        height: layer.transform.height * scale,
        outline: selected ? '2px solid #f59e0b' : undefined,
        outlineOffset: 2,
        cursor: layer.locked ? 'not-allowed' : 'crosshair',
      }}
    />
  );
}
