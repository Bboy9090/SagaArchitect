import {
  activeCaptionAt,
  clipTransitionOpacity,
  clipTransformAt,
  timelineClipDuration,
  timelineDuration,
  type PhoenixTimelineClip,
  type PhoenixVideoTimeline,
} from './video-timeline';

export interface PhoenixVideoRenderProgress {
  time: number;
  duration: number;
  progress: number;
}

export interface PhoenixVideoRenderResult {
  blob: Blob;
  mimeType: string;
  extension: 'webm' | 'mp4';
}

interface PreparedClip {
  clip: PhoenixTimelineClip;
  image?: HTMLImageElement;
  media?: HTMLMediaElement;
  gain?: GainNode;
  source?: MediaElementAudioSourceNode;
}

function supportedRecorderMime(): { mimeType: string; extension: 'webm' | 'mp4' } {
  const candidates: Array<{ mimeType: string; extension: 'webm' | 'mp4' }> = [
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];
  const found = candidates.find(candidate => MediaRecorder.isTypeSupported(candidate.mimeType));
  if (!found) throw new Error('This browser does not provide a supported video recording format.');
  return found;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('A timeline image could not be loaded.'));
    image.src = src;
  });
}

function waitForMediaMetadata(media: HTMLMediaElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (media.readyState >= 1) {
      resolve();
      return;
    }
    const cleanup = () => {
      media.onloadedmetadata = null;
      media.onerror = null;
    };
    media.onloadedmetadata = () => { cleanup(); resolve(); };
    media.onerror = () => { cleanup(); reject(new Error('A timeline media asset could not be loaded.')); };
  });
}

function containRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } {
  const sourceRatio = sourceWidth / Math.max(1, sourceHeight);
  const targetRatio = targetWidth / Math.max(1, targetHeight);
  if (sourceRatio > targetRatio) {
    const width = targetWidth;
    const height = width / sourceRatio;
    return { x: 0, y: (targetHeight - height) / 2, width, height };
  }
  const height = targetHeight;
  const width = height * sourceRatio;
  return { x: (targetWidth - width) / 2, y: 0, width, height };
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  timeline: PhoenixVideoTimeline,
  time: number,
) {
  const caption = activeCaptionAt(timeline, time);
  if (!caption) return;
  const width = timeline.width * 0.9;
  const x = timeline.width / 2;
  const fontSize = Math.max(18, caption.fontSize);
  ctx.save();
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(caption.text);
  const boxWidth = Math.min(width, metrics.width + fontSize);
  const boxHeight = fontSize * 1.5;
  const y = caption.position === 'top'
    ? timeline.height * 0.1
    : caption.position === 'center'
      ? timeline.height / 2
      : timeline.height * 0.9;
  ctx.fillStyle = caption.background;
  ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
  ctx.fillStyle = caption.color;
  ctx.fillText(caption.text, x, y, width);
  ctx.restore();
}

async function prepareClips(
  timeline: PhoenixVideoTimeline,
  audioContext: AudioContext,
  audioDestination: MediaStreamAudioDestinationNode,
): Promise<PreparedClip[]> {
  const clips = timeline.tracks.flatMap(track => track.clips);
  const prepared: PreparedClip[] = [];

  for (const clip of clips) {
    if (clip.kind === 'image') {
      prepared.push({ clip, image: await loadImage(clip.src) });
      continue;
    }

    const media = document.createElement(clip.kind === 'audio' ? 'audio' : 'video');
    media.src = clip.src;
    media.preload = 'auto';
    media.playsInline = true;
    media.crossOrigin = 'anonymous';
    await waitForMediaMetadata(media);

    const source = audioContext.createMediaElementSource(media);
    const gain = audioContext.createGain();
    source.connect(gain);
    gain.connect(audioDestination);
    prepared.push({ clip, media, source, gain });
  }

  return prepared;
}

function drawVisualClip(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedClip,
  timeline: PhoenixVideoTimeline,
  time: number,
) {
  const { clip } = prepared;
  const source = prepared.image || (prepared.media instanceof HTMLVideoElement ? prepared.media : null);
  if (!source) return;

  const sourceWidth = prepared.image?.naturalWidth || (prepared.media as HTMLVideoElement).videoWidth;
  const sourceHeight = prepared.image?.naturalHeight || (prepared.media as HTMLVideoElement).videoHeight;
  if (!sourceWidth || !sourceHeight) return;

  const base = containRect(sourceWidth, sourceHeight, timeline.width, timeline.height);
  const transform = clipTransformAt(clip, time);
  const opacity = clipTransitionOpacity(clip, time);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(timeline.width / 2 + transform.x, timeline.height / 2 + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(source, base.x - timeline.width / 2, base.y - timeline.height / 2, base.width, base.height);
  ctx.restore();
}

function clipIsActive(clip: PhoenixTimelineClip, time: number): boolean {
  return time >= clip.start && time <= clip.start + timelineClipDuration(clip);
}

async function syncPreparedMedia(prepared: PreparedClip[], time: number, playing: boolean) {
  for (const item of prepared) {
    if (!item.media) continue;
    const active = clipIsActive(item.clip, time);
    if (!active) {
      if (!item.media.paused) item.media.pause();
      if (item.gain) item.gain.gain.value = 0;
      continue;
    }

    const sourceTime = item.clip.inPoint + Math.max(0, time - item.clip.start) * item.clip.playbackRate;
    if (Math.abs(item.media.currentTime - sourceTime) > 0.25) {
      item.media.currentTime = Math.min(sourceTime, Math.max(0, item.clip.sourceDuration - 0.03));
    }
    item.media.playbackRate = item.clip.playbackRate;
    if (item.gain) {
      item.gain.gain.value = item.clip.muted
        ? 0
        : Math.max(0, Math.min(1, item.clip.volume * clipTransitionOpacity(item.clip, time)));
    }
    if (playing && item.media.paused) await item.media.play().catch(() => undefined);
  }
}

export async function renderPhoenixVideoTimeline(
  timeline: PhoenixVideoTimeline,
  onProgress?: (progress: PhoenixVideoRenderProgress) => void,
): Promise<PhoenixVideoRenderResult> {
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is unavailable in this browser.');
  const canvas = document.createElement('canvas');
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio is unavailable in this browser.');
  const audioContext = new AudioContextCtor();
  const audioDestination = audioContext.createMediaStreamDestination();
  const prepared = await prepareClips(timeline, audioContext, audioDestination);

  const canvasStream = canvas.captureStream(Math.max(1, Math.min(60, timeline.fps)));
  const outputStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ]);

  const format = supportedRecorderMime();
  const recorder = new MediaRecorder(outputStream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: timeline.width * timeline.height >= 1920 * 1080 ? 8_000_000 : 4_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const totalDuration = timelineDuration(timeline);
  await audioContext.resume();

  const finished = new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Video recording failed.'));
    recorder.onstop = () => resolve();
  });

  recorder.start(250);
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = async () => {
      const time = Math.min(totalDuration, (performance.now() - start) / 1000);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, timeline.width, timeline.height);

      await syncPreparedMedia(prepared, time, true);

      const visualClips = prepared
        .filter(item => item.clip.kind !== 'audio' && clipIsActive(item.clip, time))
        .sort((a, b) => a.clip.start - b.clip.start);
      for (const item of visualClips) drawVisualClip(ctx, item, timeline, time);
      drawCaption(ctx, timeline, time);

      onProgress?.({
        time,
        duration: totalDuration,
        progress: totalDuration > 0 ? time / totalDuration : 1,
      });

      if (time >= totalDuration) {
        resolve();
        return;
      }
      requestAnimationFrame(() => void frame());
    };
    void frame();
  });

  prepared.forEach(item => item.media?.pause());
  recorder.stop();
  await finished;
  canvasStream.getTracks().forEach(track => track.stop());
  outputStream.getTracks().forEach(track => track.stop());
  await audioContext.close();

  const blob = new Blob(chunks, { type: format.mimeType });
  if (blob.size === 0) throw new Error('The rendered video is empty.');
  return { blob, mimeType: format.mimeType, extension: format.extension };
}

export function downloadRenderedVideo(result: PhoenixVideoRenderResult, title: string): void {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phoenix-video';
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.${result.extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
