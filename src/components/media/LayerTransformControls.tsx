'use client';

import { useEffect, useRef, useState } from 'react';
import type { PhoenixLayerTransform } from '@/lib/media-composition';

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface LayerTransformControlsProps {
  transform: PhoenixLayerTransform;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  locked?: boolean;
  allowMove?: boolean;
  snapValue: (value: number) => number;
  onCommit: (transform: PhoenixLayerTransform) => void;
}

interface GestureState {
  mode: 'move' | 'resize';
  handle?: ResizeHandle;
  pointerId: number;
  clientX: number;
  clientY: number;
  start: PhoenixLayerTransform;
}

const MIN_SIZE = 12;

function equalTransform(a: PhoenixLayerTransform, b: PhoenixLayerTransform): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.rotation === b.rotation;
}

export function LayerTransformControls({
  transform,
  zoom,
  canvasWidth,
  canvasHeight,
  locked = false,
  allowMove = true,
  snapValue,
  onCommit,
}: LayerTransformControlsProps) {
  const [draft, setDraft] = useState(transform);
  const gesture = useRef<GestureState | null>(null);

  useEffect(() => {
    if (!gesture.current) setDraft(transform);
  }, [transform]);

  const clamp = (next: PhoenixLayerTransform): PhoenixLayerTransform => {
    const width = Math.max(MIN_SIZE, Math.min(next.width, canvasWidth));
    const height = Math.max(MIN_SIZE, Math.min(next.height, canvasHeight));
    const x = Math.max(0, Math.min(next.x, canvasWidth - width));
    const y = Math.max(0, Math.min(next.y, canvasHeight - height));
    return { ...next, x, y, width, height };
  };

  const updateGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = (event.clientX - state.clientX) / zoom;
    const dy = (event.clientY - state.clientY) / zoom;
    const start = state.start;

    if (state.mode === 'move') {
      setDraft(clamp({
        ...start,
        x: snapValue(start.x + dx),
        y: snapValue(start.y + dy),
      }));
      return;
    }

    let x = start.x;
    let y = start.y;
    let width = start.width;
    let height = start.height;

    if (state.handle?.includes('e')) width = snapValue(start.width + dx);
    if (state.handle?.includes('s')) height = snapValue(start.height + dy);
    if (state.handle?.includes('w')) {
      x = snapValue(start.x + dx);
      width = snapValue(start.width - dx);
    }
    if (state.handle?.includes('n')) {
      y = snapValue(start.y + dy);
      height = snapValue(start.height - dy);
    }

    if (width < MIN_SIZE) {
      if (state.handle?.includes('w')) x = start.x + start.width - MIN_SIZE;
      width = MIN_SIZE;
    }
    if (height < MIN_SIZE) {
      if (state.handle?.includes('n')) y = start.y + start.height - MIN_SIZE;
      height = MIN_SIZE;
    }

    setDraft(clamp({ ...start, x, y, width, height }));
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const target = event.currentTarget;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    gesture.current = null;
    if (!equalTransform(draft, transform)) onCommit(draft);
  };

  const beginMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || !allowMove || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      mode: 'move',
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      start: draft,
    };
  };

  const beginResize = (handle: ResizeHandle) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      mode: 'resize',
      handle,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      start: draft,
    };
  };

  const handleClass = 'absolute z-[10003] h-3 w-3 rounded-sm border border-blue-100 bg-blue-400 shadow-sm';

  return (
    <div
      data-media-interactive="true"
      className="pointer-events-none absolute z-[10002]"
      style={{
        left: draft.x * zoom,
        top: draft.y * zoom,
        width: draft.width * zoom,
        height: draft.height * zoom,
        transform: `rotate(${draft.rotation}deg)`,
        transformOrigin: 'center',
      }}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 border-2 border-blue-400" />
      {allowMove && !locked && (
        <div
          data-media-interactive="true"
          className="pointer-events-auto absolute inset-2 cursor-move bg-transparent"
          onPointerDown={beginMove}
          onPointerMove={updateGesture}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
        />
      )}
      {!locked && (
        <>
          <div
            data-media-interactive="true"
            className={`${handleClass} -left-1.5 -top-1.5 cursor-nwse-resize`}
            onPointerDown={beginResize('nw')}
            onPointerMove={updateGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          />
          <div
            data-media-interactive="true"
            className={`${handleClass} -right-1.5 -top-1.5 cursor-nesw-resize`}
            onPointerDown={beginResize('ne')}
            onPointerMove={updateGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          />
          <div
            data-media-interactive="true"
            className={`${handleClass} -bottom-1.5 -left-1.5 cursor-nesw-resize`}
            onPointerDown={beginResize('sw')}
            onPointerMove={updateGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          />
          <div
            data-media-interactive="true"
            className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`}
            onPointerDown={beginResize('se')}
            onPointerMove={updateGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          />
        </>
      )}
      {locked && (
        <div className="absolute -top-6 left-0 rounded bg-slate-900/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Locked
        </div>
      )}
    </div>
  );
}
