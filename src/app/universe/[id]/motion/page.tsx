'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { StudioRevisionPanel } from '@/components/media/StudioRevisionPanel';
import { getScenes, getStoryboardPanels, getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetAssets, dbGetProject, dbGetScenes, dbGetStoryboardPanels, dbGetStudioDocument, dbSaveStudioDocument, type ProjectAsset } from '@/lib/db-client';
import {
  buildMotionComicTimeline,
  loadMotionComicTimeline,
  saveMotionComicTimeline,
} from '@/lib/motion-comic';
import {
  activeCaptionAt,
  addClipToTimelineTrack,
  addTimelineTrack,
  clipAudioGainAt,
  clipSourceAt,
  clipTransitionState,
  clipTransformAt,
  removeEmptyTimelineTrack,
  timelineClipDuration,
  timelineDuration,
  savePhoenixVideoTimeline,
  type PhoenixTimelineClip,
  type PhoenixVideoTimeline,
} from '@/lib/video-timeline';
import type { Scene, StoryboardPanel, Universe } from '@/lib/types';
import { newestStudioDocument } from '@/lib/studio-document';

interface MotionComicPageProps {
  params: Promise<{ id: string }>;
}

export default function MotionComicPage({ params }: MotionComicPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Universe | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState('');
  const [panels, setPanels] = useState<StoryboardPanel[]>([]);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [timeline, setTimeline] = useState<PhoenixVideoTimeline | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedClipId, setSelectedClipId] = useState('');
  const [secondsPerPanel, setSecondsPerPanel] = useState(4);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const visualVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        const loadedScenes = isDbMode() ? await dbGetScenes(id) : getScenes(id);
        if (cancelled) return;
        setProject(loadedProject);
        setScenes(loadedScenes);
        const firstScene = loadedScenes[0]?.id || '';
        setSceneId(firstScene);
        if (firstScene) {
          const loadedPanels = isDbMode() ? await dbGetStoryboardPanels(firstScene) : getStoryboardPanels(firstScene);
          setPanels(loadedPanels);
        }
        const localTimeline = loadMotionComicTimeline(id);
        const cloudTimeline = isDbMode() ? await dbGetStudioDocument<PhoenixVideoTimeline>(id, 'motion_timeline') : null;
        setTimeline(newestStudioDocument(localTimeline, cloudTimeline));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!sceneId) return;
    let cancelled = false;
    void (async () => {
      const loadedPanels = isDbMode() ? await dbGetStoryboardPanels(sceneId) : getStoryboardPanels(sceneId);
      if (!cancelled) setPanels(loadedPanels);
    })();
    return () => { cancelled = true; };
  }, [sceneId]);

  useEffect(() => {
    if (!timeline) return;
    const handle = window.setTimeout(() => {
      const saved = saveMotionComicTimeline(timeline);
      if (isDbMode()) {
        void dbSaveStudioDocument(id, 'motion_timeline', saved)
          .catch(error => setStatus(error instanceof Error ? error.message : 'Studio Cloud motion autosave failed.'));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [timeline, id]);

  const duration = useMemo(() => timeline ? timelineDuration(timeline) : 1, [timeline]);
  const selectedClip = useMemo(
    () => timeline?.tracks.flatMap(track => track.clips).find(clip => clip.id === selectedClipId) || null,
    [timeline, selectedClipId],
  );
  const activeVisualLayers = useMemo(() => {
    if (!timeline) return [];
    return timeline.tracks
      .filter(track => track.kind === 'video')
      .sort((a, b) => a.order - b.order)
      .flatMap(track => track.clips.map(clip => ({ clip, trackOrder: track.order })))
      .filter(({ clip }) => playhead >= clip.start && playhead <= clip.start + timelineClipDuration(clip))
      .sort((a, b) => a.trackOrder - b.trackOrder || a.clip.start - b.clip.start);
  }, [timeline, playhead]);

  const activeCaption = useMemo(
    () => timeline ? activeCaptionAt(timeline, playhead) : null,
    [timeline, playhead],
  );
  const activeAudioClips = useMemo(() => {
    if (!timeline) return [];
    return timeline.tracks
      .filter(track => track.kind === 'audio')
      .sort((a, b) => a.order - b.order)
      .flatMap(track => track.clips)
      .filter(clip => playhead >= clip.start && playhead <= clip.start + timelineClipDuration(clip));
  }, [timeline, playhead]);

  useEffect(() => {
    if (!playing || !timeline) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setPlayhead(current => {
        const next = current + delta;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, timeline, duration]);

  useEffect(() => {
    const activeIds = new Set(activeVisualLayers.filter(({ clip }) => clip.kind === 'video').map(({ clip }) => clip.id));
    for (const [clipId, video] of visualVideoRefs.current.entries()) {
      if (!activeIds.has(clipId)) video.pause();
    }
    for (const { clip } of activeVisualLayers) {
      if (clip.kind !== 'video') continue;
      const video = visualVideoRefs.current.get(clip.id);
      if (!video) continue;
      const sourceTime = clip.inPoint + Math.max(0, playhead - clip.start) * clip.playbackRate;
      if (Number.isFinite(video.duration) && Math.abs(video.currentTime - sourceTime) > 0.3) {
        video.currentTime = Math.min(sourceTime, Math.max(0, video.duration - 0.05));
      }
      video.playbackRate = clip.playbackRate;
      video.muted = true;
      if (playing) void video.play().catch(() => undefined);
      else video.pause();
    }
  }, [activeVisualLayers, playhead, playing]);

  useEffect(() => {
    const activeIds = new Set(activeAudioClips.map(clip => clip.id));
    for (const [clipId, audio] of audioRefs.current.entries()) {
      if (!activeIds.has(clipId)) audio.pause();
    }
    for (const clip of activeAudioClips) {
      const audio = audioRefs.current.get(clip.id);
      if (!audio) continue;
      const sourceTime = clip.inPoint + Math.max(0, playhead - clip.start) * clip.playbackRate;
      if (Number.isFinite(audio.duration) && Math.abs(audio.currentTime - sourceTime) > 0.3) {
        audio.currentTime = Math.min(sourceTime, Math.max(0, audio.duration - 0.05));
      }
      audio.playbackRate = clip.playbackRate;
      audio.volume = clipAudioGainAt(clip, playhead);
      if (playing) void audio.play().catch(() => undefined);
      else audio.pause();
    }
  }, [activeAudioClips, playhead, playing]);

  const generateFromStoryboard = () => {
      if (!scene) return;
    const ordered = [...panels].sort((a, b) => a.panel_number - b.panel_number);
    const inputs = ordered.map(panel => ({
      panel,
      imageSrc: panel.asset_id
        ? `/api/db/assets/${panel.asset_id}/serve`
        : panel.image_base64 || undefined,
    }));
    const next = buildMotionComicTimeline(id, scene.title, inputs, secondsPerPanel);
    setTimeline(current => {
      if (!current) return next;
      const videoTracks = next.tracks.filter(track => track.kind === 'video');
      const audioTracks = current.tracks
        .filter(track => track.kind === 'audio')
        .map((track, index) => ({ ...track, order: videoTracks.length + index }));
      return {
        ...next,
        tracks: [...videoTracks, ...audioTracks],
      };
    });
    setSelectedClipId('');
    setSelectedTrackId('');
    setPlayhead(0);
    setPlaying(false);
    const visualCount = inputs.filter(item => item.imageSrc).length;
    setStatus(
      visualCount === ordered.length
        ? `Built ${ordered.length} animated panels from ${scene.title}.`
        : `Built timeline from ${ordered.length} panels; ${ordered.length - visualCount} panel(s) need artwork before they can animate.`,
    );
  };

  const continueInVideoStudio = async () => {
    if (!timeline) return;
    setStatus('Promoting Motion timeline to Video Studio…');
    try {
      const promoted: PhoenixVideoTimeline = {
        ...timeline,
        id: crypto.randomUUID(),
        title: timeline.title.replace(/\s+Motion Comic$/i, '') + ' — Video Edit',
        updatedAt: new Date().toISOString(),
      };
      const saved = savePhoenixVideoTimeline(promoted);
      if (isDbMode()) {
        await dbGetStudioDocument<PhoenixVideoTimeline>(id, 'video_timeline');
        await dbSaveStudioDocument(id, 'video_timeline', saved);
      }
      setStatus('Motion timeline promoted to Video Studio without flattening.');
      router.push(`/universe/${id}/video`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to promote Motion timeline to Video Studio.');
    }
  };

  const patchClip = (clipId: string, patch: Partial<PhoenixTimelineClip>) => {
    setTimeline(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip),
      })),
    }) : current);
  };

  const addOverlayTrack = () => {
    setTimeline(current => {
      if (!current) return current;
      const next = addTimelineTrack(current, 'video', `Overlay ${current.tracks.filter(track => track.kind === 'video').length}`);
      const created = [...next.tracks].sort((a, b) => b.order - a.order).find(track => track.kind === 'video');
      if (created) setSelectedTrackId(created.id);
      return next;
    });
  };

  const addOverlayAsset = (asset: ProjectAsset) => {
    if (!timeline || !asset.mime_type.startsWith('image/')) return;
    setTimeline(current => {
      if (!current) return current;
      const selected = current.tracks.find(track => track.id === selectedTrackId && track.kind === 'video');
      const target = selected || current.tracks.filter(track => track.kind === 'video').sort((a, b) => b.order - a.order)[0];
      if (!target) return current;
      const span = Math.max(0.5, Math.min(secondsPerPanel, Math.max(0.5, timelineDuration(current) - playhead)));
      setSelectedTrackId(target.id);
      return addClipToTimelineTrack(current, target.id, {
        assetId: asset.id,
        name: asset.name,
        src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
        mimeType: asset.mime_type,
        kind: 'image',
        start: playhead,
        sourceDuration: span,
        inPoint: 0,
        outPoint: span,
        playbackRate: 1,
        volume: 1,
        muted: false,
      });
    });
    setStatus(`Added ${asset.name} as a motion overlay at ${playhead.toFixed(2)}s.`);
  };

  const setImageSourceKeyframe = (asset: ProjectAsset) => {
    if (!selectedClip || selectedClip.kind !== 'image' || !asset.mime_type.startsWith('image/')) return;
    const localTime = Math.max(0, Math.min(timelineClipDuration(selectedClip), playhead - selectedClip.start));
    const sourceKeyframes = [...(selectedClip.sourceKeyframes || []).filter(frame => Math.abs(frame.time - localTime) > 0.02), {
      time: localTime,
      src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
      assetId: asset.id,
      name: asset.name,
    }].sort((a, b) => a.time - b.time);
    patchClip(selectedClip.id, { sourceKeyframes });
    setStatus(`Set ${asset.name} as a pose/source swap at ${playhead.toFixed(2)}s.`);
  };

  const shiftVisualTrack = (trackId: string, direction: -1 | 1) => {
    setTimeline(current => {
      if (!current) return current;
      const visualTracks = current.tracks
        .filter(track => track.kind === 'video')
        .sort((a, b) => a.order - b.order);
      const index = visualTracks.findIndex(track => track.id === trackId);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= visualTracks.length) return current;
      [visualTracks[index], visualTracks[swapIndex]] = [visualTracks[swapIndex], visualTracks[index]];
      const audioTracks = current.tracks
        .filter(track => track.kind === 'audio')
        .sort((a, b) => a.order - b.order);
      return {
        ...current,
        tracks: [...visualTracks, ...audioTracks].map((track, order) => ({ ...track, order })),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const deleteEmptyTrack = (trackId: string) => {
    setTimeline(current => current ? removeEmptyTimelineTrack(current, trackId) : current);
    if (selectedTrackId === trackId) setSelectedTrackId('');
  };

  const addTransformKeyframe = () => {
    if (!selectedClip) return;
    const localTime = Math.max(0, playhead - selectedClip.start);
    const keyframes = [...(selectedClip.keyframes || []).filter(frame => Math.abs(frame.time - localTime) > 0.02), {
      time: localTime,
      transform: { ...selectedClip.transform },
      easing: 'ease-in-out' as const,
    }].sort((a, b) => a.time - b.time);
    patchClip(selectedClip.id, { keyframes });
    setStatus(`Added transform keyframe at ${playhead.toFixed(2)}s.`);
  };

  const setCanvasPreset = (width: number, height: number) => {
    setTimeline(current => current ? { ...current, width, height } : current);
  };

  if (loading) {
    return (
      <Navigation>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner text="Opening Motion Comic Studio..." />
        </div>
      </Navigation>
    );
  }

  const scene = scenes.find(item => item.id === sceneId);
  const visualPanels = panels.filter(panel => panel.asset_id || panel.image_base64).length;
  const canvasRatio = timeline ? timeline.width / timeline.height : 16 / 9;

  return (
    <Navigation>
      <Header
        title="Motion Comic Studio"
        subtitle={`Storyboard-to-motion production for ${project?.name || 'Phoenix project'}`}
        actions={
          timeline ? (
            <div className="flex flex-wrap gap-2">
              <StudioRevisionPanel<PhoenixVideoTimeline>
                projectId={id}
                kind="motion_timeline"
                enabled={isDbMode()}
                onRestore={restored => {
                  setTimeline(restored);
                  setPlaying(false);
                  setPlayhead(0);
                  setStatus('Motion timeline restored from Studio Cloud.');
                }}
                onError={setStatus}
              />
              <Button size="sm" variant={timeline.width > timeline.height ? 'gold' : 'ghost'} onClick={() => setCanvasPreset(1920, 1080)}>16:9</Button>
              <Button size="sm" variant={timeline.height > timeline.width ? 'gold' : 'ghost'} onClick={() => setCanvasPreset(1080, 1920)}>9:16</Button>
              <Button size="sm" variant={timeline.height === timeline.width ? 'gold' : 'ghost'} onClick={() => setCanvasPreset(1080, 1080)}>1:1</Button>
              <Button size="sm" variant="secondary" onClick={() => void continueInVideoStudio()}>Continue in Video Studio →</Button>
            </div>
          ) : null
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 2xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Storyboard Source</p>
          {scenes.length === 0 ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-xs leading-5 text-amber-200/80">Create scenes and storyboard panels first. Motion Comic Studio converts those canonical panels into an animated timeline.</p>
            </div>
          ) : (
            <>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500">Scene
                <select
                  value={sceneId}
                  onChange={event => setSceneId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded border border-white/10 bg-[#0a0d14] px-3 text-sm text-white"
                >
                  {scenes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                  <div className="text-xl font-black text-white">{panels.length}</div>
                  <div className="text-[9px] uppercase text-slate-600">Panels</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                  <div className="text-xl font-black text-emerald-300">{visualPanels}</div>
                  <div className="text-[9px] uppercase text-slate-600">With art</div>
                </div>
              </div>

              <label className="mt-4 block text-[10px] uppercase tracking-wider text-slate-500">Seconds per panel
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={secondsPerPanel}
                  onChange={event => setSecondsPerPanel(Math.max(1, Math.min(20, Number(event.target.value) || 4)))}
                  className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-sm text-white"
                />
              </label>

              <Button className="mt-4 w-full" variant="gold" disabled={panels.length === 0} onClick={generateFromStoryboard}>
                Build Motion Timeline
              </Button>
              {status && <p className="mt-3 text-xs leading-5 text-slate-400">{status}</p>}

              <div className="mt-5 space-y-2">
                {[...panels].sort((a, b) => a.panel_number - b.panel_number).map(panel => (
                  <div key={panel.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white">Panel {panel.panel_number}</span>
                      <span className={`text-[9px] uppercase ${panel.asset_id || panel.image_base64 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {panel.asset_id || panel.image_base64 ? 'Artwork ready' : 'Needs art'}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">{panel.camera_shot || 'Default camera move'}</div>
                    {panel.dialogue && <div className="mt-2 line-clamp-2 text-[11px] text-slate-400">“{panel.dialogue}”</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        <main className="min-w-0 bg-[#04060b]">
          <section className="border-b border-white/10 p-4 md:p-6">
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <div
                className="relative flex max-h-[520px] w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black"
                style={{ aspectRatio: canvasRatio }}
              >
                {activeVisualLayers.length === 0 && <div className="text-sm text-slate-600">Build a motion timeline to preview storyboard animation.</div>}
                {activeVisualLayers.map(({ clip, trackOrder }) => {
                  const transform = clipTransformAt(clip, playhead);
                  const transition = clipTransitionState(clip, playhead);
                  const layerStyle: React.CSSProperties = {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: transition.opacity,
                    zIndex: trackOrder + 1,
                    transform: `translate(${((transform.x / Math.max(1, timeline?.width || 1920)) + transition.x) * 100}%, ${((transform.y / Math.max(1, timeline?.height || 1080)) + transition.y) * 100}%) scale(${transform.scale * transition.scale}) rotate(${transform.rotation}deg)`,
                    transformOrigin: 'center',
                  };
                  if (clip.kind === 'image') {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={clip.id} src={clipSourceAt(clip, playhead).src} alt="" style={layerStyle} />
                    );
                  }
                  if (clip.kind === 'video') {
                    return (
                      <video
                        key={clip.id}
                        ref={element => {
                          if (element) visualVideoRefs.current.set(clip.id, element);
                          else visualVideoRefs.current.delete(clip.id);
                        }}
                        src={clip.src}
                        muted
                        playsInline
                        preload="metadata"
                        style={layerStyle}
                      />
                    );
                  }
                  return null;
                })}
                {activeCaption && (
                  <div
                    className={`pointer-events-none absolute left-1/2 z-[1000] max-w-[88%] -translate-x-1/2 rounded px-4 py-2 text-center font-bold ${activeCaption.position === 'top' ? 'top-[8%]' : activeCaption.position === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[8%]'}`}
                    style={{
                      color: activeCaption.color,
                      background: activeCaption.background,
                      fontSize: Math.max(14, activeCaption.fontSize * Math.min(1, 720 / (timeline?.width || 1920))),
                    }}
                  >
                    {activeCaption.text}
                  </div>
                )}
                {activeAudioClips.map(clip => (
                  <audio
                    key={clip.id}
                    ref={element => {
                      if (element) audioRefs.current.set(clip.id, element);
                      else audioRefs.current.delete(clip.id);
                    }}
                    src={clip.src}
                    preload="metadata"
                  />
                ))}
              </div>

              {timeline && (
                <div className="mt-4 flex w-full items-center gap-3">
                  <Button size="sm" variant={playing ? 'gold' : 'secondary'} onClick={() => {
                    if (playhead >= duration) setPlayhead(0);
                    setPlaying(value => !value);
                  }}>
                    {playing ? 'Pause' : 'Play'}
                  </Button>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={Math.min(playhead, duration)}
                    onChange={event => {
                      setPlaying(false);
                      setPlayhead(Number(event.target.value));
                    }}
                    className="flex-1"
                  />
                  <span className="w-28 text-right font-mono text-xs text-slate-400">{playhead.toFixed(2)} / {duration.toFixed(2)}s</span>
                </div>
              )}
            </div>
          </section>

          <section className="p-4">
            <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.04] p-4">
              <div className="text-sm font-black text-white">Automatic panel motion</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Phoenix maps each storyboard camera shot to a start/end transform, adds fade transitions,
                turns panel dialogue into timed captions, and preserves the result as an editable motion timeline.
                Wide shots pan across the frame; close-ups push in; high/low angles move vertically.
              </p>
            </div>
          </section>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Motion Timeline</p>
          {!timeline ? (
            <p className="text-xs leading-5 text-slate-500">Choose a storyboard scene and build the motion timeline.</p>
          ) : (
            <>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-black text-white">{timeline.title}</div>
                <div className="mt-1 text-[10px] text-slate-500">{timeline.width} × {timeline.height} · {timeline.fps} fps</div>
                <div className="mt-1 text-[10px] text-slate-500">{timeline.tracks.filter(track => track.kind === 'video').reduce((sum, track) => sum + track.clips.length, 0)} visual clips · {timeline.captions.length} dialogue captions</div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-violet-300/70">Visual Tracks</p>
                  <Button size="sm" variant="ghost" onClick={addOverlayTrack}>+ Overlay</Button>
                </div>
                <div className="mt-2 space-y-2">
                  {[...timeline.tracks].filter(track => track.kind === 'video').sort((a, b) => a.order - b.order).map((track, index, ordered) => {
                    const canRemove = track.clips.length === 0 && ordered.length > 1;
                    return (
                      <div key={track.id} className={`rounded-lg border p-2 ${selectedTrackId === track.id ? 'border-violet-400/50 bg-violet-400/10' : 'border-white/10 bg-white/[0.02]'}`}>
                        <button type="button" onClick={() => setSelectedTrackId(track.id)} className="flex w-full items-center justify-between gap-2 text-left">
                          <span className="truncate text-xs font-bold text-white">{track.name}</span>
                          <span className="text-[9px] text-slate-500">{track.clips.length} clips</span>
                        </button>
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => shiftVisualTrack(track.id, -1)}>↑</Button>
                          <Button size="sm" variant="ghost" disabled={index === ordered.length - 1} onClick={() => shiftVisualTrack(track.id, 1)}>↓</Button>
                          <Button size="sm" variant="ghost" disabled={!canRemove} onClick={() => deleteEmptyTrack(track.id)}>×</Button>
                        </div>
                        <div className="mt-2 space-y-1">
                          {track.clips.map(clip => (
                            <button
                              key={clip.id}
                              type="button"
                              onClick={() => {
                                setSelectedTrackId(track.id);
                                setSelectedClipId(clip.id);
                                setPlayhead(clip.start);
                              }}
                              className={`min-h-10 w-full rounded border px-2 text-left ${selectedClipId === clip.id ? 'border-violet-300 bg-violet-500/20' : 'border-white/5 bg-black/10'}`}
                            >
                              <span className="block truncate text-[10px] font-bold text-white">{clip.name}</span>
                              <span className="block text-[9px] text-slate-500">{clip.start.toFixed(1)}s · {timelineClipDuration(clip).toFixed(1)}s</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isDbMode() && assets.some(asset => asset.mime_type.startsWith('image/')) && (
                <div className="mt-5">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[.25em] text-violet-300/70">Overlay Assets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {assets.filter(asset => asset.mime_type.startsWith('image/')).slice(0, 20).map(asset => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => addOverlayAsset(asset)}
                        className="overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left hover:border-violet-400/40"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.serve_url || `/api/db/assets/${asset.id}/serve`} alt="" className="aspect-square w-full object-cover" />
                        <span className="block truncate px-2 py-1 text-[9px] text-slate-400">{asset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedClip && selectedClip.kind !== 'audio' && (
                <div className="mt-5 rounded-xl border border-violet-400/15 bg-violet-400/[0.04] p-3">
                  <div className="text-xs font-bold text-violet-100">Motion Layer</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['scale', 'x', 'y', 'rotation'] as const).map(key => (
                      <label key={key} className="text-[9px] uppercase text-slate-500">{key}
                        <input
                          type="number"
                          step={key === 'scale' ? 0.05 : 1}
                          value={selectedClip.transform[key]}
                          onChange={event => patchClip(selectedClip.id, {
                            transform: { ...selectedClip.transform, [key]: Number(event.target.value) },
                          })}
                          className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-xs text-white"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-[9px] uppercase text-slate-500">Transition In
                      <select value={selectedClip.transitionIn} onChange={event => patchClip(selectedClip.id, { transitionIn: event.target.value as PhoenixTimelineClip['transitionIn'] })} className="mt-1 min-h-9 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-[10px] text-white">
                        <option value="none">None</option><option value="fade">Fade</option><option value="slide-left">Slide Left</option><option value="slide-right">Slide Right</option><option value="zoom">Zoom</option>
                      </select>
                    </label>
                    <label className="text-[9px] uppercase text-slate-500">Transition Out
                      <select value={selectedClip.transitionOut} onChange={event => patchClip(selectedClip.id, { transitionOut: event.target.value as PhoenixTimelineClip['transitionOut'] })} className="mt-1 min-h-9 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-[10px] text-white">
                        <option value="none">None</option><option value="fade">Fade</option><option value="slide-left">Slide Left</option><option value="slide-right">Slide Right</option><option value="zoom">Zoom</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-2 block text-[9px] uppercase text-slate-500">Transition Duration
                    <input type="number" min={0.05} max={5} step={0.05} value={selectedClip.transitionDuration} onChange={event => patchClip(selectedClip.id, { transitionDuration: Math.max(0.05, Number(event.target.value)) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-xs text-white" />
                  </label>
                  {selectedClip.kind === 'image' && isDbMode() && (
                    <div className="mt-3 rounded border border-pink-400/15 bg-pink-400/[0.04] p-3">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-pink-300">Pose / Mouth Swaps</div>
                      <p className="mt-1 text-[9px] leading-4 text-slate-500">Choose a project image to switch this clip&apos;s source at the current playhead without splitting the clip.</p>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        {assets.filter(asset => asset.mime_type.startsWith('image/')).slice(0, 12).map(asset => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => setImageSourceKeyframe(asset)}
                            className="overflow-hidden rounded border border-white/10 bg-black/20 hover:border-pink-400/40"
                            title={asset.name}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={asset.serve_url || `/api/db/assets/${asset.id}/serve`} alt="" className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                      {(selectedClip.sourceKeyframes || []).length > 0 && (
                        <div className="mt-3 space-y-1">
                          {[...(selectedClip.sourceKeyframes || [])].sort((a, b) => a.time - b.time).map((frame, index) => (
                            <div key={frame.time + '-' + index} className="flex items-center justify-between gap-2 rounded border border-white/5 bg-black/10 px-2 py-1">
                              <button type="button" onClick={() => setPlayhead(selectedClip.start + frame.time)} className="min-w-0 flex-1 truncate text-left text-[9px] text-slate-400">
                                {frame.time.toFixed(2)}s · {frame.name || 'Image swap'}
                              </button>
                              <Button size="sm" variant="ghost" onClick={() => patchClip(selectedClip.id, {
                                sourceKeyframes: (selectedClip.sourceKeyframes || []).filter(item => item !== frame),
                              })}>×</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 rounded border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">Depth Parallax</span>
                      <Button
                        size="sm"
                        variant={selectedClip.parallax?.enabled ? 'gold' : 'ghost'}
                        onClick={() => patchClip(selectedClip.id, {
                          parallax: selectedClip.parallax?.enabled
                            ? { ...selectedClip.parallax, enabled: false }
                            : (selectedClip.parallax || { enabled: true, depth: 0.7, driftX: 110, driftY: 0, zoom: 0.14 }),
                        })}
                      >
                        {selectedClip.parallax?.enabled ? 'On' : 'Enable'}
                      </Button>
                    </div>
                    {selectedClip.parallax?.enabled && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="text-[9px] uppercase text-slate-500">Depth
                          <input type="number" min={0} max={1} step={0.05} value={selectedClip.parallax.depth} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, depth: Math.max(0, Math.min(1, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-[10px] text-white" />
                        </label>
                        <label className="text-[9px] uppercase text-slate-500">Zoom
                          <input type="number" min={-0.5} max={0.5} step={0.01} value={selectedClip.parallax.zoom} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, zoom: Math.max(-0.5, Math.min(0.5, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-[10px] text-white" />
                        </label>
                        <label className="text-[9px] uppercase text-slate-500">Drift X
                          <input type="number" min={-2000} max={2000} step={5} value={selectedClip.parallax.driftX} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, driftX: Math.max(-2000, Math.min(2000, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-[10px] text-white" />
                        </label>
                        <label className="text-[9px] uppercase text-slate-500">Drift Y
                          <input type="number" min={-2000} max={2000} step={5} value={selectedClip.parallax.driftY} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, driftY: Math.max(-2000, Math.min(2000, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-[10px] text-white" />
                        </label>
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={addTransformKeyframe}>
                    Keyframe Transform Here
                  </Button>
                  <div className="mt-3 space-y-2">
                    {[...selectedClip.keyframes].sort((a, b) => a.time - b.time).map((frame, index) => (
                      <div key={frame.time + '-' + index} className="grid grid-cols-[66px_1fr] items-center gap-2">
                        <span className="font-mono text-[9px] text-slate-500">{frame.time.toFixed(2)}s</span>
                        <select
                          value={frame.easing || 'linear'}
                          onChange={event => patchClip(selectedClip.id, {
                            keyframes: selectedClip.keyframes.map(item => item === frame ? { ...item, easing: event.target.value as typeof frame.easing } : item),
                          })}
                          className="min-h-8 rounded border border-white/10 bg-[#0a0d14] px-2 text-[9px] text-white"
                        >
                          <option value="linear">Linear</option><option value="ease-in">Ease In</option><option value="ease-out">Ease Out</option><option value="ease-in-out">Ease In/Out</option><option value="hold">Hold</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
                <div className="text-xs font-bold text-amber-200">Next motion tier</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Layered overlay tracks, project-image FX, transform keyframes, synchronized Audio Studio mixes, and cloud-safe Video promotion are active.
                  Next additions are depth-assisted parallax, SFX automation, mouth/pose swaps, and richer easing controls.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </Navigation>
  );
}
