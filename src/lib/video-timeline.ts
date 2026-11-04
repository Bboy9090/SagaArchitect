export type PhoenixTimelineTrackKind = 'video' | 'audio';
export type PhoenixTimelineTrackRole = 'dialogue' | 'music' | 'sfx' | 'other';
export type PhoenixTimelineClipKind = 'image' | 'video' | 'audio';
export type PhoenixClipBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
export type PhoenixClipTransition = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';
export type PhoenixKeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';

export interface PhoenixClipTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

export interface PhoenixClipKeyframe {
  time: number;
  transform: PhoenixClipTransform;
  easing?: PhoenixKeyframeEasing;
}

export interface PhoenixAudioGainKeyframe {
  time: number;
  gain: number;
  easing?: PhoenixKeyframeEasing;
}

export interface PhoenixSpeedKeyframe {
  progress: number;
  rate: number;
  easing?: PhoenixKeyframeEasing;
}

export interface PhoenixSourceKeyframe {
  time: number;
  src: string;
  assetId?: string;
  name?: string;
}

export interface PhoenixClipTransitionState {
  opacity: number;
  x: number;
  y: number;
  scale: number;
}

export interface PhoenixClipParallax {
  enabled: boolean;
  depth: number;
  driftX: number;
  driftY: number;
  zoom: number;
}

export interface PhoenixClipAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
  sepia: number;
  blur: number;
}

export interface PhoenixClipCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_CLIP_ADJUSTMENTS: PhoenixClipAdjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  grayscale: 0,
  sepia: 0,
  blur: 0,
};

export interface PhoenixCaptionCue {
  id: string;
  text: string;
  start: number;
  end: number;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  color: string;
  background: string;
}

export interface PhoenixTimelineMarker {
  id: string;
  time: number;
  label: string;
}

export interface PhoenixTimelineWorkArea {
  start: number;
  end: number;
}

export interface PhoenixTimelineClip {
  id: string;
  trackId: string;
  assetId?: string;
  syncSource?: 'audio_mix';
  name: string;
  src: string;
  mimeType: string;
  kind: PhoenixTimelineClipKind;
  start: number;
  sourceDuration: number;
  inPoint: number;
  outPoint: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  opacity?: number;
  blendMode?: PhoenixClipBlendMode;
  transitionIn: PhoenixClipTransition;
  transitionOut: PhoenixClipTransition;
  transitionDuration: number;
  transform: PhoenixClipTransform;
  keyframes: PhoenixClipKeyframe[];
  gainKeyframes?: PhoenixAudioGainKeyframe[];
  speedKeyframes?: PhoenixSpeedKeyframe[];
  sourceKeyframes?: PhoenixSourceKeyframe[];
  parallax?: PhoenixClipParallax;
  adjustments?: PhoenixClipAdjustments;
  crop?: PhoenixClipCrop;
  createdAt: string;
}

export interface PhoenixTrackDucking {
  enabled: boolean;
  level: number;
  attack: number;
  release: number;
}

export interface PhoenixTimelineTrack {
  id: string;
  name: string;
  kind: PhoenixTimelineTrackKind;
  role?: PhoenixTimelineTrackRole;
  ducking?: PhoenixTrackDucking;
  muted?: boolean;
  solo?: boolean;
  locked?: boolean;
  order: number;
  clips: PhoenixTimelineClip[];
}

export interface PhoenixVideoTimeline {
  id: string;
  projectId: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  tracks: PhoenixTimelineTrack[];
  captions: PhoenixCaptionCue[];
  markers?: PhoenixTimelineMarker[];
  workArea?: PhoenixTimelineWorkArea;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'phoenix_video_timeline:';

export function createPhoenixVideoTimeline(projectId: string): PhoenixVideoTimeline {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: 'Untitled Video',
    width: 1920,
    height: 1080,
    fps: 30,
    tracks: [
      { id: crypto.randomUUID(), name: 'Video 1', kind: 'video', muted: false, solo: false, locked: false, order: 0, clips: [] },
      { id: crypto.randomUUID(), name: 'Audio 1', kind: 'audio', muted: false, solo: false, locked: false, order: 1, clips: [] },
    ],
    captions: [],
    markers: [],
    createdAt: now,
    updatedAt: now,
  };
}




export function normalizedClipCrop(clip: Pick<PhoenixTimelineClip, 'crop'>): PhoenixClipCrop {
  const raw = clip.crop || { top: 0, right: 0, bottom: 0, left: 0 };
  let top = Math.max(0, Math.min(0.95, raw.top));
  let right = Math.max(0, Math.min(0.95, raw.right));
  let bottom = Math.max(0, Math.min(0.95, raw.bottom));
  let left = Math.max(0, Math.min(0.95, raw.left));
  const horizontal = left + right;
  if (horizontal > 0.95) {
    const scale = 0.95 / horizontal;
    left *= scale;
    right *= scale;
  }
  const vertical = top + bottom;
  if (vertical > 0.95) {
    const scale = 0.95 / vertical;
    top *= scale;
    bottom *= scale;
  }
  return { top, right, bottom, left };
}

export function clipCropCss(clip: Pick<PhoenixTimelineClip, 'crop'>): string | undefined {
  if (!clip.crop) return undefined;
  const crop = normalizedClipCrop(clip);
  return `inset(${crop.top * 100}% ${crop.right * 100}% ${crop.bottom * 100}% ${crop.left * 100}%)`;
}

export function clipFilterCss(clip: Pick<PhoenixTimelineClip, 'adjustments'>): string {
  const adjustments = clip.adjustments;
  if (!adjustments) return 'none';
  const brightness = Math.max(0, Math.min(3, adjustments.brightness));
  const contrast = Math.max(0, Math.min(3, adjustments.contrast));
  const saturation = Math.max(0, Math.min(3, adjustments.saturation));
  const grayscale = Math.max(0, Math.min(1, adjustments.grayscale));
  const sepia = Math.max(0, Math.min(1, adjustments.sepia));
  const blur = Math.max(0, Math.min(40, adjustments.blur));
  return [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturation})`,
    `grayscale(${grayscale})`,
    `sepia(${sepia})`,
    `blur(${blur}px)`,
  ].join(' ');
}

export function isTimelineTrackActive(
  timeline: PhoenixVideoTimeline,
  track: PhoenixTimelineTrack,
): boolean {
  if (track.muted) return false;
  const peers = timeline.tracks.filter(item => item.kind === track.kind);
  const hasSolo = peers.some(item => item.solo && !item.muted);
  return hasSolo ? Boolean(track.solo) : true;
}

export function isTimelineClipLocked(
  timeline: PhoenixVideoTimeline,
  clipId: string,
): boolean {
  const track = timeline.tracks.find(item => item.clips.some(clip => clip.id === clipId));
  return Boolean(track?.locked);
}

export function timelineStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadPhoenixVideoTimeline(projectId: string): PhoenixVideoTimeline | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(timelineStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhoenixVideoTimeline;
    if (!parsed || parsed.projectId !== projectId || !Array.isArray(parsed.tracks)) return null;
    return {
      ...parsed,
      captions: Array.isArray(parsed.captions) ? parsed.captions : [],
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
      workArea: parsed.workArea && Number.isFinite(parsed.workArea.start) && Number.isFinite(parsed.workArea.end)
        ? {
            start: Math.max(0, Math.min(parsed.workArea.start, parsed.workArea.end)),
            end: Math.max(0, Math.max(parsed.workArea.start, parsed.workArea.end)),
          }
        : undefined,
      tracks: parsed.tracks.map(track => ({
        ...track,
        muted: Boolean(track.muted),
        solo: Boolean(track.solo),
        locked: Boolean(track.locked),
        clips: track.clips.map(clip => ({
          ...clip,
          opacity: Number.isFinite(clip.opacity) ? Math.max(0, Math.min(1, clip.opacity as number)) : 1,
          blendMode: clip.blendMode || 'normal',
          transitionIn: clip.transitionIn || 'none',
          transitionOut: clip.transitionOut || 'none',
          transitionDuration: Number.isFinite(clip.transitionDuration) ? clip.transitionDuration : 0.5,
          transform: clip.transform || { scale: 1, x: 0, y: 0, rotation: 0 },
          keyframes: Array.isArray(clip.keyframes) ? clip.keyframes : [],
          speedKeyframes: Array.isArray(clip.speedKeyframes) ? clip.speedKeyframes : [],
        })),
      })),
    };
  } catch {
    return null;
  }
}

export function savePhoenixVideoTimeline(timeline: PhoenixVideoTimeline): PhoenixVideoTimeline {
  const saved = { ...timeline, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(timelineStorageKey(saved.projectId), JSON.stringify(saved));
  }
  return saved;
}

export function timelineClipDuration(clip: PhoenixTimelineClip): number {
  return Math.max(0.05, (Math.max(clip.inPoint, clip.outPoint) - Math.min(clip.inPoint, clip.outPoint)) / Math.max(0.05, clip.playbackRate));
}

export function timelineDuration(timeline: PhoenixVideoTimeline): number {
  return Math.max(
    1,
    ...timeline.tracks.flatMap(track => track.clips.map(clip => clip.start + timelineClipDuration(clip))),
  );
}

export function addTimelineTrack(
  timeline: PhoenixVideoTimeline,
  kind: PhoenixTimelineTrackKind,
  name?: string,
): PhoenixVideoTimeline {
  const peers = timeline.tracks.filter(track => track.kind === kind);
  const nextOrder = timeline.tracks.reduce((max, track) => Math.max(max, track.order), -1) + 1;
  const track: PhoenixTimelineTrack = {
    id: crypto.randomUUID(),
    name: name || `${kind === 'video' ? 'Video' : 'Audio'} ${peers.length + 1}`,
    kind,
    muted: false,
    solo: false,
    locked: false,
    order: nextOrder,
    clips: [],
  };
  return { ...timeline, tracks: [...timeline.tracks, track], updatedAt: new Date().toISOString() };
}

export function removeEmptyTimelineTrack(
  timeline: PhoenixVideoTimeline,
  trackId: string,
): PhoenixVideoTimeline {
  const target = timeline.tracks.find(track => track.id === trackId);
  if (!target || target.clips.length > 0) return timeline;
  const sameKind = timeline.tracks.filter(track => track.kind === target.kind);
  if (sameKind.length <= 1) return timeline;
  const remaining = timeline.tracks.filter(track => track.id !== trackId)
    .sort((a, b) => a.order - b.order)
    .map((track, index) => ({ ...track, order: index }));
  return { ...timeline, tracks: remaining, updatedAt: new Date().toISOString() };
}

export function moveTimelineTrack(
  timeline: PhoenixVideoTimeline,
  trackId: string,
  direction: -1 | 1,
): PhoenixVideoTimeline {
  const ordered = [...timeline.tracks].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex(track => track.id === trackId);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return timeline;
  [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  return {
    ...timeline,
    tracks: ordered.map((track, order) => ({ ...track, order })),
    updatedAt: new Date().toISOString(),
  };
}

export function addClipToTimelineTrack(
  timeline: PhoenixVideoTimeline,
  trackId: string,
  input: Omit<PhoenixTimelineClip, 'id' | 'trackId' | 'createdAt' | 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes' | 'opacity' | 'blendMode'> & Partial<Pick<PhoenixTimelineClip, 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes' | 'opacity' | 'blendMode'>>,
): PhoenixVideoTimeline {
  const targetKind: PhoenixTimelineTrackKind = input.kind === 'audio' ? 'audio' : 'video';
  const track = timeline.tracks.find(item => item.id === trackId && item.kind === targetKind);
  if (!track) return timeline;
  const clip: PhoenixTimelineClip = {
    ...input,
    opacity: Number.isFinite(input.opacity) ? Math.max(0, Math.min(1, input.opacity as number)) : 1,
    blendMode: input.blendMode || 'normal',
    transitionIn: input.transitionIn || 'none',
    transitionOut: input.transitionOut || 'none',
    transitionDuration: typeof input.transitionDuration === 'number' && Number.isFinite(input.transitionDuration) ? input.transitionDuration : 0.5,
    transform: input.transform || { scale: 1, x: 0, y: 0, rotation: 0 },
    keyframes: input.keyframes || [],
    id: crypto.randomUUID(),
    trackId: track.id,
    createdAt: new Date().toISOString(),
  };
  return {
    ...timeline,
    tracks: timeline.tracks.map(item => item.id === track.id ? { ...item, clips: [...item.clips, clip] } : item),
    updatedAt: new Date().toISOString(),
  };
}

export function addClipToTimeline(
  timeline: PhoenixVideoTimeline,
  input: Omit<PhoenixTimelineClip, 'id' | 'trackId' | 'createdAt' | 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes' | 'opacity' | 'blendMode'> & Partial<Pick<PhoenixTimelineClip, 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes' | 'opacity' | 'blendMode'>>,
): PhoenixVideoTimeline {
  const targetKind: PhoenixTimelineTrackKind = input.kind === 'audio' ? 'audio' : 'video';
  const track = timeline.tracks
    .filter(item => item.kind === targetKind)
    .sort((a, b) => a.order - b.order)[0];
  return track ? addClipToTimelineTrack(timeline, track.id, input) : timeline;
}

export function splitTimelineClip(
  timeline: PhoenixVideoTimeline,
  clipId: string,
  playhead: number,
): PhoenixVideoTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => {
      const clip = track.clips.find(item => item.id === clipId);
      if (!clip || track.locked) return track;
      const duration = timelineClipDuration(clip);
      const localTimelineTime = playhead - clip.start;
      if (localTimelineTime <= 0.05 || localTimelineTime >= duration - 0.05) return track;
      const sourceSplit = clipSourceTimeAt(clip, playhead);
      const splitProgress = duration > 0 ? localTimelineTime / duration : 0;
      const first: PhoenixTimelineClip = {
        ...clip,
        outPoint: sourceSplit,
        playbackRate: clip.speedKeyframes?.length
          ? playbackRateForTimelineSpan(clip.inPoint, sourceSplit, localTimelineTime, clip.playbackRate)
          : clip.playbackRate,
        speedKeyframes: sliceSpeedKeyframes(clip, 0, splitProgress),
      };
      const second: PhoenixTimelineClip = {
        ...clip,
        id: crypto.randomUUID(),
        start: playhead,
        inPoint: sourceSplit,
        playbackRate: clip.speedKeyframes?.length
          ? playbackRateForTimelineSpan(sourceSplit, clip.outPoint, duration - localTimelineTime, clip.playbackRate)
          : clip.playbackRate,
        speedKeyframes: sliceSpeedKeyframes(clip, splitProgress, 1),
        createdAt: new Date().toISOString(),
      };
      return {
        ...track,
        clips: track.clips.flatMap(item => item.id === clipId ? [first, second] : [item]),
      };
    }),
  };
}


function applyKeyframeEasing(easing: PhoenixKeyframeEasing | undefined, value: number): number {
  const t = Math.max(0, Math.min(1, value));
  switch (easing || 'linear') {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'hold':
      return t >= 1 ? 1 : 0;
    default:
      return t;
  }
}

function applyClipParallax(
  clip: PhoenixTimelineClip,
  transform: PhoenixClipTransform,
  localTime: number,
): PhoenixClipTransform {
  const effect = clip.parallax;
  if (!effect?.enabled) return transform;
  const duration = timelineClipDuration(clip);
  const progress = duration > 0 ? Math.max(0, Math.min(1, localTime / duration)) : 0;
  const centered = progress - 0.5;
  const depth = Math.max(0, Math.min(1, effect.depth));
  return {
    scale: Math.max(0.01, transform.scale * (1 + effect.zoom * depth * centered)),
    x: transform.x + effect.driftX * depth * centered,
    y: transform.y + effect.driftY * depth * centered,
    rotation: transform.rotation,
  };
}


function normalizedSpeedFrames(clip: PhoenixTimelineClip): PhoenixSpeedKeyframe[] {
  const explicit = (clip.speedKeyframes || [])
    .filter(frame => Number.isFinite(frame.progress) && Number.isFinite(frame.rate))
    .map(frame => ({
      ...frame,
      progress: Math.max(0, Math.min(1, frame.progress)),
      rate: Math.max(0.1, Math.min(4, frame.rate)),
    }))
    .sort((a, b) => a.progress - b.progress);
  const hasStart = explicit.some(frame => frame.progress <= 0.0001);
  const hasEnd = explicit.some(frame => frame.progress >= 0.9999);
  const frames = [
    ...(hasStart ? [] : [{ progress: 0, rate: 1, easing: 'linear' as PhoenixKeyframeEasing }]),
    ...explicit,
    ...(hasEnd ? [] : [{ progress: 1, rate: 1, easing: 'linear' as PhoenixKeyframeEasing }]),
  ].sort((a, b) => a.progress - b.progress);
  const deduped: PhoenixSpeedKeyframe[] = [];
  for (const frame of frames) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.progress - frame.progress) < 0.0001) {
      deduped[deduped.length - 1] = frame;
    } else {
      deduped.push(frame);
    }
  }
  return deduped;
}

function speedMultiplierAtProgress(clip: PhoenixTimelineClip, progress: number): number {
  const frames = normalizedSpeedFrames(clip);
  const p = Math.max(0, Math.min(1, progress));
  if (p <= frames[0].progress) return frames[0].rate;
  if (p >= frames[frames.length - 1].progress) return frames[frames.length - 1].rate;
  const rightIndex = frames.findIndex(frame => frame.progress >= p);
  const left = frames[Math.max(0, rightIndex - 1)];
  const right = frames[rightIndex];
  const span = Math.max(0.0001, right.progress - left.progress);
  const t = applyKeyframeEasing(left.easing, (p - left.progress) / span);
  return Math.max(0.1, Math.min(4, left.rate + (right.rate - left.rate) * t));
}

function speedIntegral(clip: PhoenixTimelineClip, endProgress: number, samples = 48): number {
  const end = Math.max(0, Math.min(1, endProgress));
  if (end <= 0) return 0;
  const steps = Math.max(8, Math.ceil(samples * end));
  const step = end / steps;
  let area = 0;
  let previous = speedMultiplierAtProgress(clip, 0);
  for (let index = 1; index <= steps; index += 1) {
    const current = speedMultiplierAtProgress(clip, index * step);
    area += (previous + current) * 0.5 * step;
    previous = current;
  }
  return area;
}

export function clipSpeedMultiplierAt(clip: PhoenixTimelineClip, timelineTime: number): number {
  const duration = timelineClipDuration(clip);
  const localTime = Math.max(0, Math.min(duration, timelineTime - clip.start));
  const progress = duration > 0 ? localTime / duration : 0;
  return speedMultiplierAtProgress(clip, progress);
}

function sliceSpeedKeyframes(
  clip: PhoenixTimelineClip,
  startProgress: number,
  endProgress: number,
): PhoenixSpeedKeyframe[] | undefined {
  if (!(clip.speedKeyframes?.length)) return undefined;
  const start = Math.max(0, Math.min(1, startProgress));
  const end = Math.max(start + 0.0001, Math.min(1, endProgress));
  const span = end - start;
  const interior = (clip.speedKeyframes || [])
    .filter(frame => frame.progress > start + 0.0001 && frame.progress < end - 0.0001)
    .map(frame => ({ ...frame, progress: (frame.progress - start) / span }));
  return [
    { progress: 0, rate: speedMultiplierAtProgress(clip, start), easing: 'linear' },
    ...interior,
    { progress: 1, rate: speedMultiplierAtProgress(clip, end), easing: 'linear' },
  ];
}

function playbackRateForTimelineSpan(sourceStart: number, sourceEnd: number, timelineSpan: number, fallback: number): number {
  if (!Number.isFinite(timelineSpan) || timelineSpan <= 0.0001) return Math.max(0.05, fallback);
  return Math.max(0.05, Math.abs(sourceEnd - sourceStart) / timelineSpan);
}

export function clipSourceTimeAt(clip: PhoenixTimelineClip, timelineTime: number): number {
  const duration = timelineClipDuration(clip);
  const localTime = Math.max(0, Math.min(duration, timelineTime - clip.start));
  if (!(clip.speedKeyframes?.length)) {
    return Math.max(clip.inPoint, Math.min(clip.outPoint, clip.inPoint + localTime * Math.max(0.05, clip.playbackRate)));
  }
  const progress = duration > 0 ? localTime / duration : 0;
  const total = Math.max(0.0001, speedIntegral(clip, 1));
  const sourceProgress = Math.max(0, Math.min(1, speedIntegral(clip, progress) / total));
  return clip.inPoint + (clip.outPoint - clip.inPoint) * sourceProgress;
}

export function clipPlaybackRateAt(clip: PhoenixTimelineClip, timelineTime: number): number {
  if (!(clip.speedKeyframes?.length)) return Math.max(0.05, clip.playbackRate);
  const duration = timelineClipDuration(clip);
  const localTime = Math.max(0, Math.min(duration, timelineTime - clip.start));
  const progress = duration > 0 ? localTime / duration : 0;
  const total = Math.max(0.0001, speedIntegral(clip, 1));
  return Math.max(0.05, Math.min(8, Math.max(0.05, clip.playbackRate) * speedMultiplierAtProgress(clip, progress) / total));
}

export function clipTransformAt(clip: PhoenixTimelineClip, timelineTime: number): PhoenixClipTransform {
  const base = clip.transform || { scale: 1, x: 0, y: 0, rotation: 0 };
  const localTime = Math.max(0, timelineTime - clip.start);
  const frames = [...(clip.keyframes || [])].sort((a, b) => a.time - b.time);
  let resolved = base;
  if (frames.length > 0) {
    if (localTime <= frames[0].time) {
      resolved = frames[0].transform;
    } else if (localTime >= frames[frames.length - 1].time) {
      resolved = frames[frames.length - 1].transform;
    } else {
      const rightIndex = frames.findIndex(frame => frame.time >= localTime);
      const left = frames[Math.max(0, rightIndex - 1)];
      const right = frames[rightIndex];
      const span = Math.max(0.0001, right.time - left.time);
      const rawT = Math.max(0, Math.min(1, (localTime - left.time) / span));
      const t = applyKeyframeEasing(left.easing, rawT);
      const lerp = (a: number, b: number) => a + (b - a) * t;
      resolved = {
        scale: lerp(left.transform.scale, right.transform.scale),
        x: lerp(left.transform.x, right.transform.x),
        y: lerp(left.transform.y, right.transform.y),
        rotation: lerp(left.transform.rotation, right.transform.rotation),
      };
    }
  }
  return applyClipParallax(clip, resolved, localTime);
}

function applyTransition(
  state: PhoenixClipTransitionState,
  transition: PhoenixClipTransition,
  progress: number,
): PhoenixClipTransitionState {
  const p = Math.max(0, Math.min(1, progress));
  if (transition === 'fade') return { ...state, opacity: state.opacity * p };
  if (transition === 'slide-left') return { ...state, x: state.x - (1 - p) };
  if (transition === 'slide-right') return { ...state, x: state.x + (1 - p) };
  if (transition === 'zoom') return { ...state, scale: state.scale * (0.88 + 0.12 * p), opacity: state.opacity * (0.35 + 0.65 * p) };
  return state;
}

export function clipTransitionState(clip: PhoenixTimelineClip, timelineTime: number): PhoenixClipTransitionState {
  const duration = timelineClipDuration(clip);
  const localTime = Math.max(0, Math.min(duration, timelineTime - clip.start));
  const transitionDuration = Math.max(0.05, Math.min(clip.transitionDuration || 0.5, duration / 2));
  let state: PhoenixClipTransitionState = { opacity: 1, x: 0, y: 0, scale: 1 };
  if (clip.transitionIn !== 'none' && localTime < transitionDuration) {
    state = applyTransition(state, clip.transitionIn, localTime / transitionDuration);
  }
  if (clip.transitionOut !== 'none' && duration - localTime < transitionDuration) {
    state = applyTransition(state, clip.transitionOut, (duration - localTime) / transitionDuration);
  }
  return {
    opacity: Math.max(0, Math.min(1, state.opacity)),
    x: Math.max(-1, Math.min(1, state.x)),
    y: Math.max(-1, Math.min(1, state.y)),
    scale: Math.max(0.01, state.scale),
  };
}

export function clipTransitionOpacity(clip: PhoenixTimelineClip, timelineTime: number): number {
  return clipTransitionState(clip, timelineTime).opacity;
}

export function clipVolumeAutomationAt(clip: PhoenixTimelineClip, timelineTime: number): number {
  const localTime = Math.max(0, timelineTime - clip.start);
  const frames = [...(clip.gainKeyframes || [])].sort((a, b) => a.time - b.time);
  const base = Math.max(0, Math.min(1, clip.volume));
  if (frames.length === 0) return base;
  if (localTime <= frames[0].time) return Math.max(0, Math.min(1, frames[0].gain));
  if (localTime >= frames[frames.length - 1].time) return Math.max(0, Math.min(1, frames[frames.length - 1].gain));
  const rightIndex = frames.findIndex(frame => frame.time >= localTime);
  const left = frames[Math.max(0, rightIndex - 1)];
  const right = frames[rightIndex];
  const span = Math.max(0.0001, right.time - left.time);
  const rawT = Math.max(0, Math.min(1, (localTime - left.time) / span));
  const t = applyKeyframeEasing(left.easing, rawT);
  return Math.max(0, Math.min(1, left.gain + (right.gain - left.gain) * t));
}

export function clipAudioGainAt(clip: PhoenixTimelineClip, timelineTime: number): number {
  if (clip.muted) return 0;
  const duration = timelineClipDuration(clip);
  const localTime = Math.max(0, Math.min(duration, timelineTime - clip.start));
  const transitionDuration = Math.max(0.05, Math.min(clip.transitionDuration || 0.5, duration / 2));
  let gain = clipVolumeAutomationAt(clip, timelineTime);
  if (clip.transitionIn === 'fade' && localTime < transitionDuration) gain *= localTime / transitionDuration;
  if (clip.transitionOut === 'fade' && duration - localTime < transitionDuration) gain *= (duration - localTime) / transitionDuration;
  return Math.max(0, Math.min(1, gain));
}



function duckingMultiplierAt(
  timeline: PhoenixVideoTimeline,
  targetTrack: PhoenixTimelineTrack,
  timelineTime: number,
): number {
  const config = targetTrack.ducking;
  if (targetTrack.role !== 'music' || !config?.enabled) return 1;
  const level = Math.max(0, Math.min(1, config.level));
  const attack = Math.max(0, config.attack);
  const release = Math.max(0, config.release);
  let multiplier = 1;
  const dialogueClips = timeline.tracks
    .filter(track => track.kind === 'audio' && track.role === 'dialogue' && isTimelineTrackActive(timeline, track))
    .flatMap(track => track.clips)
    .filter(clip => !clip.muted);

  for (const dialogue of dialogueClips) {
    const start = dialogue.start;
    const end = dialogue.start + timelineClipDuration(dialogue);
    if (timelineTime >= start && timelineTime <= end) {
      multiplier = Math.min(multiplier, level);
      continue;
    }
    if (attack > 0 && timelineTime < start && timelineTime >= start - attack) {
      const progress = (timelineTime - (start - attack)) / attack;
      multiplier = Math.min(multiplier, 1 - (1 - level) * Math.max(0, Math.min(1, progress)));
    }
    if (release > 0 && timelineTime > end && timelineTime <= end + release) {
      const progress = (timelineTime - end) / release;
      multiplier = Math.min(multiplier, level + (1 - level) * Math.max(0, Math.min(1, progress)));
    }
  }
  return Math.max(0, Math.min(1, multiplier));
}

export function timelineClipAudioGainAt(
  timeline: PhoenixVideoTimeline,
  clip: PhoenixTimelineClip,
  timelineTime: number,
): number {
  const base = clipAudioGainAt(clip, timelineTime);
  const track = timeline.tracks.find(item => item.id === clip.trackId);
  if (!track || !isTimelineTrackActive(timeline, track)) return 0;
  return Math.max(0, Math.min(1, base * duckingMultiplierAt(timeline, track, timelineTime)));
}

export function clipSourceAt(
  clip: PhoenixTimelineClip,
  timelineTime: number,
): { src: string; assetId?: string; name?: string } {
  const localTime = Math.max(0, timelineTime - clip.start);
  const frames = [...(clip.sourceKeyframes || [])].sort((a, b) => a.time - b.time);
  let resolved = { src: clip.src, assetId: clip.assetId, name: clip.name };
  for (const frame of frames) {
    if (frame.time > localTime) break;
    resolved = { src: frame.src, assetId: frame.assetId, name: frame.name || clip.name };
  }
  return resolved;
}

export function activeCaptionAt(timeline: PhoenixVideoTimeline, time: number): PhoenixCaptionCue | null {
  return timeline.captions.find(cue => time >= cue.start && time <= cue.end) || null;
}



export function timelineEditPoints(
  timeline: PhoenixVideoTimeline,
  excludeClipId?: string,
): number[] {
  const points = new Set<number>([0, timelineDuration(timeline)]);
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      points.add(Math.max(0, clip.start));
      points.add(Math.max(0, clip.start + timelineClipDuration(clip)));
    }
  }
  for (const cue of timeline.captions) {
    points.add(Math.max(0, cue.start));
    points.add(Math.max(0, cue.end));
  }
  for (const marker of timeline.markers || []) {
    points.add(Math.max(0, marker.time));
  }
  return [...points].filter(Number.isFinite).sort((a, b) => a - b);
}

export function snapTimelineTime(
  timeline: PhoenixVideoTimeline,
  time: number,
  threshold = 0.12,
  excludeClipId?: string,
): number {
  const target = Math.max(0, Number.isFinite(time) ? time : 0);
  let best = target;
  let bestDistance = Math.max(0, threshold);
  for (const point of timelineEditPoints(timeline, excludeClipId)) {
    const distance = Math.abs(point - target);
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return Math.max(0, best);
}

export function shiftTimelineTrackFrom(
  timeline: PhoenixVideoTimeline,
  trackId: string,
  fromTime: number,
  delta: number,
  excludeClipId?: string,
): PhoenixVideoTimeline {
  const targetTrack = timeline.tracks.find(track => track.id === trackId);
  if (targetTrack?.locked) return timeline;
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.0001) return timeline;
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id !== trackId ? track : {
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id === excludeClipId || clip.start < fromTime - 0.0001) return clip;
        return { ...clip, start: Math.max(0, clip.start + delta) };
      }),
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function moveTimelineClip(
  timeline: PhoenixVideoTimeline,
  clipId: string,
  requestedStart: number,
  options?: { ripple?: boolean; snap?: boolean; snapThreshold?: number },
): PhoenixVideoTimeline {
  const track = timeline.tracks.find(item => item.clips.some(clip => clip.id === clipId));
  const clip = track?.clips.find(item => item.id === clipId);
  if (!track || !clip || track.locked) return timeline;
  const nextStart = options?.snap
    ? snapTimelineTime(timeline, requestedStart, options.snapThreshold ?? 0.12, clipId)
    : Math.max(0, requestedStart);
  const delta = nextStart - clip.start;
  let next = timeline;
  if (options?.ripple && Math.abs(delta) > 0.0001) {
    const rippleFrom = clip.start + timelineClipDuration(clip);
    next = shiftTimelineTrackFrom(next, track.id, rippleFrom, delta, clipId);
  }
  return {
    ...next,
    tracks: next.tracks.map(item => item.id !== track.id ? item : {
      ...item,
      clips: item.clips.map(existing => existing.id === clipId ? { ...existing, start: nextStart } : existing),
    }),
    updatedAt: new Date().toISOString(),
  };
}


export function moveTimelineClipToTrack(
  timeline: PhoenixVideoTimeline,
  clipId: string,
  targetTrackId: string,
  requestedStart: number,
  options?: { ripple?: boolean; snap?: boolean; snapThreshold?: number },
): PhoenixVideoTimeline {
  const sourceTrack = timeline.tracks.find(track => track.clips.some(clip => clip.id === clipId));
  const clip = sourceTrack?.clips.find(item => item.id === clipId);
  const targetTrack = timeline.tracks.find(track => track.id === targetTrackId);
  if (!sourceTrack || !clip || !targetTrack || sourceTrack.locked || targetTrack.locked) return timeline;
  const requiredKind: PhoenixTimelineTrackKind = clip.kind === 'audio' ? 'audio' : 'video';
  if (targetTrack.kind !== requiredKind) return timeline;
  if (sourceTrack.id === targetTrack.id) {
    return moveTimelineClip(timeline, clipId, requestedStart, options);
  }

  const nextStart = options?.snap
    ? snapTimelineTime(timeline, requestedStart, options.snapThreshold ?? 0.12, clipId)
    : Math.max(0, requestedStart);
  const duration = timelineClipDuration(clip);
  let next: PhoenixVideoTimeline = {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id !== sourceTrack.id ? track : {
      ...track,
      clips: track.clips.filter(existing => existing.id !== clipId),
    }),
    updatedAt: new Date().toISOString(),
  };

  if (options?.ripple) {
    next = shiftTimelineTrackFrom(next, sourceTrack.id, clip.start + duration, -duration);
    next = shiftTimelineTrackFrom(next, targetTrack.id, nextStart, duration);
  }

  return {
    ...next,
    tracks: next.tracks.map(track => track.id !== targetTrack.id ? track : {
      ...track,
      clips: [...track.clips, { ...clip, trackId: targetTrack.id, start: nextStart }],
    }),
    updatedAt: new Date().toISOString(),
  };
}


export function trimTimelineClipAt(
  timeline: PhoenixVideoTimeline,
  clipId: string,
  playhead: number,
  edge: 'in' | 'out',
  ripple = false,
): PhoenixVideoTimeline {
  const track = timeline.tracks.find(item => item.clips.some(clip => clip.id === clipId));
  const clip = track?.clips.find(item => item.id === clipId);
  if (!track || !clip || track.locked) return timeline;

  const duration = timelineClipDuration(clip);
  const clipEnd = clip.start + duration;
  const cutTime = Math.max(clip.start + 0.05, Math.min(clipEnd - 0.05, playhead));
  if (cutTime <= clip.start || cutTime >= clipEnd) return timeline;

  const elapsed = cutTime - clip.start;
  const sourceAtCut = Math.max(
    clip.inPoint + 0.05,
    Math.min(clip.outPoint - 0.05, clipSourceTimeAt(clip, cutTime)),
  );

  if (edge === 'in') {
    const removedDuration = elapsed;
    let next: PhoenixVideoTimeline = {
      ...timeline,
      tracks: timeline.tracks.map(item => item.id !== track.id ? item : {
        ...item,
        clips: item.clips.map(existing => existing.id !== clipId ? existing : {
          ...existing,
          start: ripple ? clip.start : cutTime,
          inPoint: sourceAtCut,
          playbackRate: clip.speedKeyframes?.length
            ? playbackRateForTimelineSpan(sourceAtCut, clip.outPoint, duration - elapsed, clip.playbackRate)
            : clip.playbackRate,
          speedKeyframes: sliceSpeedKeyframes(clip, duration > 0 ? elapsed / duration : 0, 1),
        }),
      }),
      updatedAt: new Date().toISOString(),
    };
    if (ripple && removedDuration > 0.0001) {
      next = shiftTimelineTrackFrom(next, track.id, clipEnd, -removedDuration, clipId);
    }
    return next;
  }

  const oldEnd = clipEnd;
  const removedDuration = oldEnd - cutTime;
  let next: PhoenixVideoTimeline = {
    ...timeline,
    tracks: timeline.tracks.map(item => item.id !== track.id ? item : {
      ...item,
      clips: item.clips.map(existing => existing.id !== clipId ? existing : {
        ...existing,
        outPoint: sourceAtCut,
        playbackRate: clip.speedKeyframes?.length
          ? playbackRateForTimelineSpan(clip.inPoint, sourceAtCut, elapsed, clip.playbackRate)
          : clip.playbackRate,
        speedKeyframes: sliceSpeedKeyframes(clip, 0, duration > 0 ? elapsed / duration : 1),
      }),
    }),
    updatedAt: new Date().toISOString(),
  };
  if (ripple && removedDuration > 0.0001) {
    next = shiftTimelineTrackFrom(next, track.id, oldEnd, -removedDuration, clipId);
  }
  return next;
}

export function removeTimelineClip(
  timeline: PhoenixVideoTimeline,
  clipId: string,
  ripple = false,
): PhoenixVideoTimeline {
  const track = timeline.tracks.find(item => item.clips.some(clip => clip.id === clipId));
  const clip = track?.clips.find(item => item.id === clipId);
  if (!track || !clip || track.locked) return timeline;
  const duration = timelineClipDuration(clip);
  const end = clip.start + duration;
  let next: PhoenixVideoTimeline = {
    ...timeline,
    tracks: timeline.tracks.map(item => item.id !== track.id ? item : {
      ...item,
      clips: item.clips.filter(existing => existing.id !== clipId),
    }),
    updatedAt: new Date().toISOString(),
  };
  if (ripple) next = shiftTimelineTrackFrom(next, track.id, end, -duration);
  return next;
}

export function replaceSyncedAudioMixClip(
  timeline: PhoenixVideoTimeline,
  input: {
    assetId: string;
    src: string;
    name: string;
    duration: number;
  },
): PhoenixVideoTimeline {
  const audioTrack = timeline.tracks.find(track => track.kind === 'audio');
  if (!audioTrack) return timeline;
  const clip: PhoenixTimelineClip = {
    id: crypto.randomUUID(),
    trackId: audioTrack.id,
    assetId: input.assetId,
    syncSource: 'audio_mix',
    name: input.name,
    src: input.src,
    mimeType: 'audio/wav',
    kind: 'audio',
    start: 0,
    sourceDuration: Math.max(0.05, input.duration),
    inPoint: 0,
    outPoint: Math.max(0.05, input.duration),
    playbackRate: 1,
    volume: 1,
    muted: false,
    transitionIn: 'none',
    transitionOut: 'none',
    transitionDuration: 0.5,
    transform: { scale: 1, x: 0, y: 0, rotation: 0 },
    keyframes: [],
    createdAt: new Date().toISOString(),
  };
  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id === audioTrack.id
      ? {
          ...track,
          clips: [...track.clips.filter(existing => existing.syncSource !== 'audio_mix'), clip],
        }
      : track),
    updatedAt: new Date().toISOString(),
  };
}
