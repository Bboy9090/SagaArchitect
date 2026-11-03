import {
  activeCaptionAt,
  clipTransitionOpacity,
  clipTransformAt,
  timelineClipDuration,
  timelineDuration,
  type PhoenixTimelineClip,
  type PhoenixVideoTimeline,
} from './video-timeline';

interface PreparedVisual {
  clip: PhoenixTimelineClip;
  trackOrder: number;
  image?: HTMLImageElement;
  video?: HTMLVideoElement;
}

function supportedWebmMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image clip for render.'));
    image.src = src;
  });
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    if (/^https?:\/\//i.test(src)) video.crossOrigin = 'anonymous';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('Failed to load video clip for render.'));
    video.src = src;
    video.load();
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = canvasWidth / canvasHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
}

function drawVisual(
  ctx: CanvasRenderingContext2D,
  visual: PreparedVisual,
  timelineTime: number,
  width: number,
  height: number,
): void {
  const clip = visual.clip;
  const transform = clipTransformAt(clip, timelineTime);
  const opacity = clipTransitionOpacity(clip, timelineTime);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.scale, transform.scale);
  ctx.translate(-width / 2, -height / 2);

  if (clip.kind === 'image' && visual.image) {
    drawCover(ctx, visual.image, visual.image.naturalWidth, visual.image.naturalHeight, width, height);
  } else if (clip.kind === 'video' && visual.video && visual.video.readyState >= 2) {
    drawCover(ctx, visual.video, visual.video.videoWidth, visual.video.videoHeight, width, height);
  }
  ctx.restore();
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  timeline: PhoenixVideoTimeline,
  time: number,
): void {
  const cue = activeCaptionAt(timeline, time);
  if (!cue) return;
  const fontSize = Math.max(18, cue.fontSize);
  ctx.save();
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = timeline.width * 0.86;
  const words = cue.text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const lineHeight = fontSize * 1.22;
  const blockHeight = lines.length * lineHeight + fontSize * 0.7;
  const centerY = cue.position === 'top'
    ? timeline.height * 0.12
    : cue.position === 'center'
      ? timeline.height * 0.5
      : timeline.height * 0.86;

  ctx.fillStyle = cue.background;
  ctx.fillRect(
    timeline.width * 0.05,
    centerY - blockHeight / 2,
    timeline.width * 0.9,
    blockHeight,
  );
  ctx.fillStyle = cue.color;
  lines.forEach((text, index) => {
    const y = centerY + (index - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(text, timeline.width / 2, y, maxWidth);
  });
  ctx.restore();
}

async function prepareVisuals(timeline: PhoenixVideoTimeline): Promise<PreparedVisual[]> {
  const entries = timeline.tracks
    .filter(track => track.kind === 'video')
    .sort((a, b) => a.order - b.order)
    .flatMap(track => track.clips.map(clip => ({ clip, trackOrder: track.order })));
  return await Promise.all(entries.map(async ({ clip, trackOrder }) => {
    if (clip.kind === 'image') return { clip, trackOrder, image: await loadImage(clip.src) };
    if (clip.kind === 'video') return { clip, trackOrder, video: await loadVideo(clip.src) };
    return { clip, trackOrder };
  }));
}

async function prepareAudio(
  context: AudioContext,
  destination: MediaStreamAudioDestinationNode,
  timeline: PhoenixVideoTimeline,
): Promise<AudioBufferSourceNode[]> {
  const clips = timeline.tracks.filter(track => track.kind === 'audio').flatMap(track => track.clips);
  const sources: AudioBufferSourceNode[] = [];
  for (const clip of clips) {
    if (clip.muted) continue;
    const response = await fetch(clip.src);
    if (!response.ok) throw new Error(`Failed to load audio clip: ${clip.name}`);
    const buffer = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.05, clip.playbackRate);
    gain.gain.value = Math.max(0, Math.min(1, clip.volume));
    source.connect(gain).connect(destination);
    const offset = Math.max(0, Math.min(clip.inPoint, buffer.duration));
    const span = Math.max(0.01, Math.min(clip.outPoint, buffer.duration) - offset);
    source.start(context.currentTime + Math.max(0, clip.start), offset, span);
    sources.push(source);
  }
  return sources;
}

export interface PhoenixVideoRenderProgress {
  elapsed: number;
  duration: number;
  ratio: number;
}

export async function renderPhoenixTimelineWebm(
  timeline: PhoenixVideoTimeline,
  onProgress?: (progress: PhoenixVideoRenderProgress) => void,
): Promise<Blob> {
  const mimeType = supportedWebmMimeType();
  if (!mimeType) throw new Error('This browser does not provide a supported WebM MediaRecorder encoder.');

  const canvas = document.createElement('canvas');
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  const duration = timelineDuration(timeline);
  const visuals = await prepareVisuals(timeline);
  const stream = canvas.captureStream(Math.max(1, Math.min(60, timeline.fps || 30)));

  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();
  const hasAudio = timeline.tracks.some(track => track.kind === 'audio' && track.clips.some(clip => !clip.muted));
  if (hasAudio) {
    for (const track of audioDestination.stream.getAudioTracks()) stream.addTrack(track);
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: timeline.width * timeline.height >= 1920 * 1080 ? 10_000_000 : 6_000_000,
  });
  recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const activeVideos = new Set<HTMLVideoElement>();
  const cleanup = async () => {
    visuals.forEach(item => {
      if (item.video) {
        item.video.pause();
        item.video.removeAttribute('src');
        item.video.load();
      }
    });
    stream.getTracks().forEach(track => track.stop());
    await audioContext.close().catch(() => undefined);
  };

  return await new Promise<Blob>(async (resolve, reject) => {
    recorder.onerror = () => {
      void cleanup();
      reject(new Error('Video recorder failed during export.'));
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      void cleanup().then(() => resolve(blob));
    };

    try {
      await audioContext.resume();
      if (hasAudio) await prepareAudio(audioContext, audioDestination, timeline);
      recorder.start(500);
      const started = performance.now();

      const frame = async (now: number) => {
        const time = Math.min(duration, (now - started) / 1000);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, timeline.width, timeline.height);

        const active = visuals
          .filter(item => time >= item.clip.start && time <= item.clip.start + timelineClipDuration(item.clip))
          .sort((a, b) => a.trackOrder - b.trackOrder || a.clip.start - b.clip.start);

        for (const visual of visuals) {
          const video = visual.video;
          if (!video) continue;
          const isActive = active.includes(visual);
          if (isActive) {
            const sourceTime = visual.clip.inPoint + Math.max(0, time - visual.clip.start) * visual.clip.playbackRate;
            if (Math.abs(video.currentTime - sourceTime) > 0.35) {
              try { video.currentTime = sourceTime; } catch {}
            }
            video.playbackRate = visual.clip.playbackRate;
            if (!activeVideos.has(video)) {
              activeVideos.add(video);
              void video.play().catch(() => undefined);
            }
          } else if (activeVideos.has(video)) {
            activeVideos.delete(video);
            video.pause();
          }
        }

        active.forEach(visual => drawVisual(ctx, visual, time, timeline.width, timeline.height));
        drawCaption(ctx, timeline, time);
        onProgress?.({ elapsed: time, duration, ratio: duration > 0 ? time / duration : 1 });

        if (time >= duration) {
          recorder.stop();
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    } catch (error) {
      if (recorder.state !== 'inactive') recorder.stop();
      void cleanup();
      reject(error instanceof Error ? error : new Error('Video export failed.'));
    }
  });
}

export function downloadVideoBlob(blob: Blob, title: string): void {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phoenix-video';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.webm`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
