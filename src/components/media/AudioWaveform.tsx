'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  src: string;
  height?: number;
}

export function AudioWaveform({ src, height = 48 }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error('audio fetch failed');
        const buffer = await response.arrayBuffer();
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) throw new Error('Web Audio unavailable');
        const context = new AudioContextCtor();
        const decoded = await context.decodeAudioData(buffer.slice(0));
        await context.close();
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const channel = decoded.getChannelData(0);
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width * window.devicePixelRatio));
        const pixelHeight = Math.max(1, Math.round(height * window.devicePixelRatio));
        canvas.width = width;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, pixelHeight);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = Math.max(1, window.devicePixelRatio);
        ctx.beginPath();
        const center = pixelHeight / 2;
        const samplesPerPixel = Math.max(1, Math.floor(channel.length / width));
        for (let x = 0; x < width; x += 1) {
          const start = x * samplesPerPixel;
          const end = Math.min(channel.length, start + samplesPerPixel);
          let peak = 0;
          for (let i = start; i < end; i += 1) peak = Math.max(peak, Math.abs(channel[i]));
          const amplitude = peak * (pixelHeight * 0.45);
          ctx.moveTo(x, center - amplitude);
          ctx.lineTo(x, center + amplitude);
        }
        ctx.stroke();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [src, height]);

  if (failed) {
    return <div className="flex items-center justify-center rounded bg-white/[0.03] text-[10px] text-slate-600" style={{ height }}>Waveform unavailable</div>;
  }

  return <canvas ref={canvasRef} className="w-full rounded bg-white/[0.02]" style={{ height }} aria-label="Audio waveform" />;
}
