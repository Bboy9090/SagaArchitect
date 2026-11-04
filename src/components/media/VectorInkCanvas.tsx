'use client';

import { useEffect, useRef } from 'react';
import {
  vectorPathSvgD,
  type PhoenixPathLayer,
  type PhoenixVectorPoint,
} from '@/lib/media-composition';

interface VectorInkCanvasProps {
  layer: PhoenixPathLayer;
  scale: number;
  selected: boolean;
  stroke: string;
  strokeWidth: number;
  onSelect: () => void;
  onCommitStroke: (points: PhoenixVectorPoint[]) => void;
}

export function VectorInkCanvas({
  layer,
  scale,
  selected,
  stroke,
  strokeWidth,
  onSelect,
  onCommitStroke,
}: VectorInkCanvasProps) {
  const drawing = useRef(false);
  const points = useRef<PhoenixVectorPoint[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    points.current = [];
    drawing.current = false;
  }, [layer.id]);

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * layer.transform.width,
      y: ((event.clientY - rect.top) / rect.height) * layer.transform.height,
    };
  };

  const begin = (event: React.PointerEvent<SVGSVGElement>) => {
    onSelect();
    if (layer.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    points.current = [point(event)];
  };

  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current || layer.locked) return;
    const next = point(event);
    const last = points.current[points.current.length - 1];
    if (!last || Math.hypot(next.x - last.x, next.y - last.y) >= 2) {
      points.current.push(next);
    }
  };

  const end = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    const committed = points.current;
    points.current = [];
    if (committed.length >= 2) onCommitStroke(committed);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${layer.transform.width} ${layer.transform.height}`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={`Vector ink layer ${layer.name}`}
      className="block touch-none overflow-visible"
      style={{
        width: layer.transform.width * scale,
        height: layer.transform.height * scale,
        outline: selected ? '2px solid #22d3ee' : undefined,
        outlineOffset: 2,
        cursor: layer.locked ? 'not-allowed' : 'crosshair',
      }}
    >
      <path
        d={vectorPathSvgD(layer)}
        fill="none"
        stroke={layer.stroke || stroke}
        strokeWidth={layer.strokeWidth || strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
