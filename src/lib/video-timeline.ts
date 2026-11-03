export type PhoenixTimelineTrackKind = 'video' | 'audio';
export type PhoenixTimelineClipKind = 'image' | 'video' | 'audio';

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
    return parsed;
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
  input: Omit<PhoenixTimelineClip, 'id' | 'trackId' | 'createdAt'>,
): PhoenixVideoTimeline {
  const targetKind: PhoenixTimelineTrackKind = input.kind === 'audio' ? 'audio' : 'video';
  const track = timeline.tracks.find(item => item.kind === targetKind);
  if (!track) return timeline;
  const clip: PhoenixTimelineClip = {
    ...input,
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
