import type { StoryboardPanel } from './types';
import type { PhoenixCaptionCue, PhoenixClipTransform, PhoenixVideoTimeline } from './video-timeline';

const STORAGE_PREFIX = 'phoenix_motion_comic_timeline:';

export interface MotionComicPanelInput {
  panel: StoryboardPanel;
  imageSrc?: string;
}

export function motionComicStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function saveMotionComicTimeline(timeline: PhoenixVideoTimeline): PhoenixVideoTimeline {
  const saved = { ...timeline, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(motionComicStorageKey(saved.projectId), JSON.stringify(saved));
  }
  return saved;
}

export function loadMotionComicTimeline(projectId: string): PhoenixVideoTimeline | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(motionComicStorageKey(projectId));
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
          transitionIn: clip.transitionIn || 'fade',
          transitionOut: clip.transitionOut || 'fade',
          transitionDuration: Number.isFinite(clip.transitionDuration) ? clip.transitionDuration : 0.35,
          transform: clip.transform || { scale: 1, x: 0, y: 0, rotation: 0 },
          keyframes: Array.isArray(clip.keyframes) ? clip.keyframes : [],
        })),
      })),
    };
  } catch {
    return null;
  }
}

function cameraMotion(cameraShot?: string): { start: PhoenixClipTransform; end: PhoenixClipTransform } {
  const shot = (cameraShot || '').toLowerCase();
  if (shot.includes('close')) {
    return {
      start: { scale: 1.04, x: 0, y: 0, rotation: 0 },
      end: { scale: 1.16, x: -18, y: -8, rotation: 0 },
    };
  }
  if (shot.includes('wide') || shot.includes('establish')) {
    return {
      start: { scale: 1.02, x: -22, y: 0, rotation: 0 },
      end: { scale: 1.08, x: 22, y: 0, rotation: 0 },
    };
  }
  if (shot.includes('low angle')) {
    return {
      start: { scale: 1.02, x: 0, y: 16, rotation: 0 },
      end: { scale: 1.11, x: 0, y: -12, rotation: 0 },
    };
  }
  if (shot.includes('high angle')) {
    return {
      start: { scale: 1.08, x: 0, y: -16, rotation: 0 },
      end: { scale: 1.02, x: 0, y: 12, rotation: 0 },
    };
  }
  return {
    start: { scale: 1, x: 0, y: 0, rotation: 0 },
    end: { scale: 1.1, x: 12, y: 0, rotation: 0 },
  };
}

export function buildMotionComicTimeline(
  projectId: string,
  sceneTitle: string,
  inputs: MotionComicPanelInput[],
  secondsPerPanel = 4,
): PhoenixVideoTimeline {
  const now = new Date().toISOString();
  const videoTrackId = crypto.randomUUID();
  const audioTrackId = crypto.randomUUID();
  const duration = Math.max(1, secondsPerPanel);
  const captions: PhoenixCaptionCue[] = [];
  const clips = inputs.flatMap((input, index) => {
    const start = index * duration;
    const panel = input.panel;
    if (panel.dialogue?.trim()) {
      captions.push({
        id: crypto.randomUUID(),
        text: panel.dialogue.trim(),
        start: start + 0.2,
        end: start + duration - 0.2,
        position: 'bottom',
        fontSize: 44,
        color: '#ffffff',
        background: 'rgba(0,0,0,0.58)',
      });
    }
    if (!input.imageSrc) return [];
    const motion = cameraMotion(panel.camera_shot);
    return [{
      id: crypto.randomUUID(),
      trackId: videoTrackId,
      assetId: panel.asset_id,
      name: `Panel ${panel.panel_number}: ${panel.action_description || panel.visual_prompt || 'Motion panel'}`,
      src: input.imageSrc,
      mimeType: input.imageSrc.startsWith('data:') ? 'image/png' : 'image/*',
      kind: 'image' as const,
      start,
      sourceDuration: duration,
      inPoint: 0,
      outPoint: duration,
      playbackRate: 1,
      volume: 1,
      muted: false,
      transitionIn: 'fade' as const,
      transitionOut: 'fade' as const,
      transitionDuration: Math.min(0.4, duration / 4),
      transform: motion.start,
      keyframes: [
        { time: 0, transform: motion.start },
        { time: duration, transform: motion.end },
      ],
      createdAt: now,
    }];
  });

  return {
    id: crypto.randomUUID(),
    projectId,
    title: `${sceneTitle || 'Scene'} Motion Comic`,
    width: 1920,
    height: 1080,
    fps: 30,
    tracks: [
      { id: videoTrackId, name: 'Panels', kind: 'video', order: 0, clips },
      { id: audioTrackId, name: 'Audio', kind: 'audio', order: 1, clips: [] },
    ],
    captions,
    createdAt: now,
    updatedAt: now,
  };
}
