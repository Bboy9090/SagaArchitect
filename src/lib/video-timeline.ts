export type PhoenixTimelineTrackKind = 'video' | 'audio';
export type PhoenixTimelineClipKind = 'image' | 'video' | 'audio';
export type PhoenixClipTransition = 'none' | 'fade';

export interface PhoenixClipTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

export interface PhoenixClipKeyframe {
  time: number;
  transform: PhoenixClipTransform;
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
  createdAt: string;
}

export interface PhoenixTimelineTrack {
  id: string;
  name: string;
  kind: PhoenixTimelineTrackKind;
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

export function addClipToTimeline(
  timeline: PhoenixVideoTimeline,
  input: Omit<PhoenixTimelineClip, 'id' | 'trackId' | 'createdAt' | 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes'> & Partial<Pick<PhoenixTimelineClip, 'transitionIn' | 'transitionOut' | 'transitionDuration' | 'transform' | 'keyframes'>>,
): PhoenixVideoTimeline {
  const targetKind: PhoenixTimelineTrackKind = input.kind === 'audio' ? 'audio' : 'video';
  const track = timeline.tracks.find(item => item.kind === targetKind);
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
  };
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


export function clipTransformAt(clip: PhoenixTimelineClip, timelineTime: number): PhoenixClipTransform {
  const base = clip.transform || { scale: 1, x: 0, y: 0, rotation: 0 };
  const localTime = Math.max(0, timelineTime - clip.start);
  const frames = [...(clip.keyframes || [])].sort((a, b) => a.time - b.time);
  if (frames.length === 0) return base;
  if (localTime <= frames[0].time) return frames[0].transform;
  if (localTime >= frames[frames.length - 1].time) return frames[frames.length - 1].transform;

  const rightIndex = frames.findIndex(frame => frame.time >= localTime);
  const left = frames[Math.max(0, rightIndex - 1)];
  const right = frames[rightIndex];
  const span = Math.max(0.0001, right.time - left.time);
  const t = Math.max(0, Math.min(1, (localTime - left.time) / span));
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    scale: lerp(left.transform.scale, right.transform.scale),
    x: lerp(left.transform.x, right.transform.x),
    y: lerp(left.transform.y, right.transform.y),
    rotation: lerp(left.transform.rotation, right.transform.rotation),
  };
}

export function clipTransitionOpacity(clip: PhoenixTimelineClip, timelineTime: number): number {
  const duration = timelineClipDuration(clip);
  const localTime = Math.max(0, timelineTime - clip.start);
  let opacity = 1;
  const transitionDuration = Math.max(0.05, Math.min(clip.transitionDuration || 0.5, duration / 2));
  if (clip.transitionIn === 'fade') opacity = Math.min(opacity, localTime / transitionDuration);
  if (clip.transitionOut === 'fade') opacity = Math.min(opacity, (duration - localTime) / transitionDuration);
  return Math.max(0, Math.min(1, opacity));
}

export function activeCaptionAt(timeline: PhoenixVideoTimeline, time: number): PhoenixCaptionCue | null {
  return timeline.captions.find(cue => time >= cue.start && time <= cue.end) || null;
}
