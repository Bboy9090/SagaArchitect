export type PhoenixTimelineTrackKind = 'video' | 'audio';
export type PhoenixTimelineTrackRole = 'dialogue' | 'music' | 'sfx' | 'other';
export type PhoenixTimelineClipKind = 'image' | 'video' | 'audio';
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
  transitionIn: PhoenixClipTransition;
  transitionOut: PhoenixClipTransition;
  transitionDuration: number;
  transform: PhoenixClipTransform;
  keyframes: PhoenixClipKeyframe[];
  gainKeyframes?: PhoenixAudioGainKeyframe[];
  sourceKeyframes?: PhoenixSourceKeyframe[];
  parallax?: PhoenixClipParallax;
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
      { id: crypto.randomUUID(), name: 'Video 1', kind: 'video', order: 0, clips: [] },
      { id: crypto.randomUUID(), name: 'Audio 1', kind: 'audio', order: 1, clips: [] },
    ],
    captions: [],
    createdAt: now,
    updatedAt: now,
  };
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
      tracks: parsed.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => ({
          ...clip,
          transitionIn: clip.transitionIn || 'none',
          transitionOut: clip.transitionOut || 'none',
          transitionDuration: Number.isFinite(clip.transitionDuration) ? clip.transitionDuration : 0.5,
          transform: clip.transform || { scale: 1, x: 0, y: 0, rotation: 0 },
          keyframes: Array.isArray(clip.keyframes) ? clip.keyframes : [],
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
  input: Omit<PhoenixTimelineClip, 'id' | 'trackId' | 'createdAt' | 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes'> & Partial<Pick<PhoenixTimelineClip, 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes'>>,
): PhoenixVideoTimeline {
  const targetKind: PhoenixTimelineTrackKind = input.kind === 'audio' ? 'audio' : 'video';
  const track = timeline.tracks.find(item => item.id === trackId && item.kind === targetKind);
  if (!track) return timeline;
  const clip: PhoenixTimelineClip = {
    ...input,
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
  input: Omit<PhoenixTimelineClip, 'id' | 'trackId' | 'createdAt' | 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes'> & Partial<Pick<PhoenixTimelineClip, 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes'>>,
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
      if (!clip) return track;
      const duration = timelineClipDuration(clip);
      const localTimelineTime = playhead - clip.start;
      if (localTimelineTime <= 0.05 || localTimelineTime >= duration - 0.05) return track;
      const sourceSplit = clip.inPoint + localTimelineTime * clip.playbackRate;
      const first = { ...clip, outPoint: sourceSplit };
      const second: PhoenixTimelineClip = {
        ...clip,
        id: crypto.randomUUID(),
        start: playhead,
        inPoint: sourceSplit,
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
    .filter(track => track.kind === 'audio' && track.role === 'dialogue')
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
  if (!track) return base;
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
  if (!track || !clip) return timeline;
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
  if (!sourceTrack || !clip || !targetTrack) return timeline;
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

export function removeTimelineClip(
  timeline: PhoenixVideoTimeline,
  clipId: string,
  ripple = false,
): PhoenixVideoTimeline {
  const track = timeline.tracks.find(item => item.clips.some(clip => clip.id === clipId));
  const clip = track?.clips.find(item => item.id === clipId);
  if (!track || !clip) return timeline;
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
