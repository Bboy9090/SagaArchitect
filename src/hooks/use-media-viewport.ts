'use client';

import { useCallback, useRef, useState } from 'react';

export interface MediaViewportState {
  zoom: number;
  showGuides: boolean;
  snap: boolean;
  showRulers: boolean;
}

export function useMediaViewport(initialZoom = 0.5) {
  const [zoom, setZoomState] = useState(initialZoom);
  const [showGuides, setShowGuides] = useState(true);
  const [snap, setSnap] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panState = useRef<{ active: boolean; x: number; y: number; left: number; top: number }>({
    active: false,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
  });

  const setZoom = useCallback((value: number | ((current: number) => number)) => {
    setZoomState(current => {
      const next = typeof value === 'function' ? value(current) : value;
      return Math.max(0.1, Math.min(4, next));
    });
  }, []);

  const snapValue = useCallback((value: number, step = 10) => (
    snap ? Math.round(value / step) * step : value
  ), [snap]);

  const fitToView = useCallback((documentWidth: number, documentHeight: number) => {
    const el = scrollRef.current;
    if (!el || documentWidth <= 0 || documentHeight <= 0) return;
    const horizontalPadding = showRulers ? 96 : 64;
    const verticalPadding = showRulers ? 96 : 64;
    const availableWidth = Math.max(1, el.clientWidth - horizontalPadding);
    const availableHeight = Math.max(1, el.clientHeight - verticalPadding);
    setZoom(Math.min(1, availableWidth / documentWidth, availableHeight / documentHeight));
    requestAnimationFrame(() => {
      const target = scrollRef.current;
      if (!target) return;
      target.scrollLeft = Math.max(0, (target.scrollWidth - target.clientWidth) / 2);
      target.scrollTop = Math.max(0, (target.scrollHeight - target.clientHeight) / 2);
    });
  }, [setZoom, showRulers]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const el = scrollRef.current;
    if (!el) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-media-interactive="true"]')) return;
    panState.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
    };
    el.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const state = panState.current;
    if (!el || !state.active) return;
    el.scrollLeft = state.left - (event.clientX - state.x);
    el.scrollTop = state.top - (event.clientY - state.y);
  }, []);

  const stopPan = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (el && event && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    panState.current.active = false;
  }, []);

  return {
    zoom,
    setZoom,
    showGuides,
    setShowGuides,
    snap,
    setSnap,
    showRulers,
    setShowRulers,
    snapValue,
    fitToView,
    scrollRef,
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stopPan,
      onPointerCancel: stopPan,
      onPointerLeave: stopPan,
    },
  };
}
