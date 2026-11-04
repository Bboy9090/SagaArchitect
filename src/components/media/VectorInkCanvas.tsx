'use client';

import { useEffect, useRef } from 'react';
import {
  vectorContourSvgD,
  type PhoenixPathLayer,
  type PhoenixVectorPoint,
} from '@/lib/media-composition';

interface VectorInkCanvasProps {
  layer: PhoenixPathLayer;
  scale: number;
  selected: boolean;
  stroke: string;
  strokeWidth: number;
  stabilization?: number;
  pressureSensitivity?: number;
  onSelect: () => void;
  onCommitStroke: (points: PhoenixVectorPoint[]) => void;
}

export function VectorInkCanvas({
  layer,
  scale,
  selected,
  stroke,
  strokeWidth,
  stabilization = 0,
  pressureSensitivity = 1,
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
    const rawPressure = event.pressure && event.pressure > 0 ? event.pressure : 0.5;
    const sensitivity = Math.max(0, Math.min(1, pressureSensitivity));
    const pressure = 0.5 + (rawPressure - 0.5) * sensitivity;
    return {
      x: ((event.clientX - rect.left) / rect.width) * layer.transform.width,
      y: ((event.clientY - rect.top) / rect.height) * layer.transform.height,
      pressure,
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

  const smoothPoints = (input: PhoenixVectorPoint[]) => {
    const amount = Math.max(0, Math.min(0.95, stabilization));
    if (amount <= 0 || input.length < 3) return input;
    const passes = Math.max(1, Math.round(amount * 4));
    let current = input;
    for (let pass = 0; pass < passes; pass += 1) {
      current = current.map((point, index) => {
        if (index === 0 || index === current.length - 1) return point;
        const previous = current[index - 1];
        const next = current[index + 1];
        const weight = 0.22 + amount * 0.18;
        return {
          x: point.x * (1 - weight * 2) + (previous.x + next.x) * weight,
          y: point.y * (1 - weight * 2) + (previous.y + next.y) * weight,
          pressure: (point.pressure ?? 0.5) * (1 - weight * 2)
            + ((previous.pressure ?? 0.5) + (next.pressure ?? 0.5)) * weight,
        };
      });
    }
    return current;
  };

  const end = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    const committed = smoothPoints(points.current);
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
      {layer.points.length > 0 && (
        <path
          d={vectorContourSvgD(layer.points, layer.closed)}
          fill="none"
          stroke={layer.stroke || stroke}
          strokeWidth={layer.strokeWidth || strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {(layer.contours || []).map(contour => {
        const baseWidth = contour.strokeWidth || layer.strokeWidth || strokeWidth;
        const contourStroke = contour.stroke || layer.stroke || stroke;
        const opacity = Number.isFinite(contour.opacity) ? contour.opacity : 1;
        const hasPressure = contour.points.some(point => Number.isFinite(point.pressure));
        if (!hasPressure) {
          return (
            <path
              key={contour.id}
              d={vectorContourSvgD(contour.points, contour.closed)}
              fill="none"
              stroke={contourStroke}
              strokeWidth={baseWidth}
              opacity={opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        return (
          <g key={contour.id} opacity={opacity}>
            {contour.points.slice(1).map((point, index) => {
              const previous = contour.points[index];
              const pressure = ((previous.pressure ?? 0.5) + (point.pressure ?? 0.5)) / 2;
              return (
                <line
                  key={index}
                  x1={previous.x}
                  y1={previous.y}
                  x2={point.x}
                  y2={point.y}
                  stroke={contourStroke}
                  strokeWidth={Math.max(0.5, baseWidth * (0.35 + pressure))}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
