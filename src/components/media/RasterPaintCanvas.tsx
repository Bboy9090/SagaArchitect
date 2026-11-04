'use client';

import { useEffect, useRef } from 'react';
import type { PhoenixRasterLayer } from '@/lib/media-composition';

export type RasterBrushTexture = 'smooth' | 'marker' | 'chalk' | 'spray';

interface RasterPaintCanvasProps {
  layer: PhoenixRasterLayer;
  scale: number;
  selected: boolean;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  erase: boolean;
  stabilization?: number;
  symmetry?: 'none' | 'vertical' | 'horizontal' | 'both';
  brushTexture?: RasterBrushTexture;
  textureStrength?: number;
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
  stabilization = 0,
  symmetry = 'none',
  brushTexture = 'smooth',
  textureStrength = 0.5,
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
    const raw = point(event);
    const amount = Math.max(0, Math.min(0.95, stabilization));
    const next = {
      x: previous.x * amount + raw.x * (1 - amount),
      y: previous.y * amount + raw.y * (1 - amount),
    };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.5;
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    const width = Math.max(1, brushSize * (0.5 + pressure));
    const strength = Math.max(0, Math.min(1, textureStrength));

    const hashNoise = (x: number, y: number, seed: number) => {
      const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
      return value - Math.floor(value);
    };

    const drawSmoothSegment = (fromX: number, fromY: number, toX: number, toY: number, marker = false) => {
      ctx.globalAlpha = brushOpacity * (marker ? 0.78 : 1);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = marker ? width * 1.25 : width;
      ctx.lineCap = marker ? 'square' : 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    };

    const drawTexturedSegment = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      texture: Exclude<RasterBrushTexture, 'smooth' | 'marker'>,
    ) => {
      const distance = Math.hypot(toX - fromX, toY - fromY);
      const spacing = Math.max(1.5, width * (texture === 'spray' ? 0.18 : 0.12));
      const steps = Math.max(1, Math.min(64, Math.ceil(distance / spacing)));
      const particles = Math.max(3, Math.min(12, Math.round(3 + strength * (texture === 'spray' ? 9 : 6))));
      for (let step = 0; step <= steps; step += 1) {
        const t = steps > 0 ? step / steps : 0;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t;
        for (let particle = 0; particle < particles; particle += 1) {
          const seed = step * 31 + particle * 17;
          const angle = hashNoise(x, y, seed) * Math.PI * 2;
          const spread = width * (texture === 'spray' ? (0.25 + strength * 0.75) : (0.1 + strength * 0.35));
          const radius = hashNoise(y, x, seed + 7) * spread;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          const dotRadius = Math.max(
            0.45,
            width * (texture === 'spray' ? 0.025 + hashNoise(px, py, seed + 13) * 0.035 : 0.035 + hashNoise(px, py, seed + 13) * 0.055),
          );
          ctx.globalAlpha = brushOpacity * (texture === 'spray' ? 0.1 + strength * 0.12 : 0.18 + strength * 0.22);
          ctx.fillStyle = brushColor;
          ctx.beginPath();
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawSegment = (fromX: number, fromY: number, toX: number, toY: number) => {
      if (erase || brushTexture === 'smooth') {
        drawSmoothSegment(fromX, fromY, toX, toY);
      } else if (brushTexture === 'marker') {
        drawSmoothSegment(fromX, fromY, toX, toY, true);
      } else {
        drawTexturedSegment(fromX, fromY, toX, toY, brushTexture);
      }
    };

    drawSegment(previous.x, previous.y, next.x, next.y);
    if (symmetry === 'vertical' || symmetry === 'both') {
      drawSegment(canvas.width - previous.x, previous.y, canvas.width - next.x, next.y);
    }
    if (symmetry === 'horizontal' || symmetry === 'both') {
      drawSegment(previous.x, canvas.height - previous.y, next.x, canvas.height - next.y);
    }
    if (symmetry === 'both') {
      drawSegment(canvas.width - previous.x, canvas.height - previous.y, canvas.width - next.x, canvas.height - next.y);
    }
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
