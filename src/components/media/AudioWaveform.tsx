'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  src: string;
  color?: string;
}

export function AudioWaveform({ src, color = '#a78bfa' }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      setState('loading');
      try {
        const response = await fetch(src, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('Waveform media could not be loaded.');
        const bytes = await response.arrayBuffer();
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) throw new Error('Web Audio is unavailable.');
        const context = new AudioContextCtor();
        const decoded = await context.decodeAudioData(bytes.slice(0));
        await context.close();
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = Math.max(240, Math.floor(canvas.clientWidth * window.devicePixelRatio));
        const height = Math.max(48, Math.floor(canvas.clientHeight * window.devicePixelRatio));
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        const channel = decoded.getChannelData(0);
        const samplesPerPixel = Math.max(1, Math.floor(channel.length / width));
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, window.devicePixelRatio);
        ctx.beginPath();
        for (let x = 0; x < width; x += 1) {
          const start = x * samplesPerPixel;
          const end = Math.min(channel.length, start + samplesPerPixel);
          let min = 1;
          let max = -1;
          for (let i = start; i < end; i += 1) {
            const sample = channel[i];
            if (sample < min) min = sample;
            if (sample > max) max = sample;
          }
          const y1 = ((1 - max) / 2) * height;
          const y2 = ((1 - min) / 2) * height;
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
        }
        ctx.stroke();
        setState('ready');
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src, color]);

  return (
    <div className="relative h-14 w-full overflow-hidden rounded bg-black/20">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="Audio waveform" />
      {state === 'loading' && <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider text-slate-600">Decoding waveform…</span>}
      {state === 'error' && <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider text-slate-600">Waveform unavailable</span>}
    </div>
  );
}
