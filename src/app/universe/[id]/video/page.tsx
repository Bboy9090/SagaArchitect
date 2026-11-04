'use client';

import { use, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { AudioWaveform } from '@/components/media/AudioWaveform';
import { StudioRevisionPanel } from '@/components/media/StudioRevisionPanel';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetAssets, dbGetProject, dbGetStudioDocument, dbSaveStudioDocument, dbUploadAsset, type ProjectAsset } from '@/lib/db-client';
import {
  activeCaptionAt,
  addClipToTimelineTrack,
  addTimelineTrack,
  clipSourceAt,
  clipTransitionState,
  clipVolumeAutomationAt,
  clipTransformAt,
  createPhoenixVideoTimeline,
  loadPhoenixVideoTimeline,
  moveTimelineClip,
  moveTimelineTrack,
  removeEmptyTimelineTrack,
  removeTimelineClip,
  savePhoenixVideoTimeline,
  shiftTimelineTrackFrom,
  snapTimelineTime,
  splitTimelineClip,
  timelineClipAudioGainAt,
  timelineClipDuration,
  timelineDuration,
  type PhoenixTimelineClip,
  type PhoenixTimelineClipKind,
  type PhoenixTimelineTrack,
  type PhoenixTimelineTrackRole,
  type PhoenixVideoTimeline,
} from '@/lib/video-timeline';
import { downloadVideoBlob, renderPhoenixTimelineWebm } from '@/lib/video-renderer';
import { newestStudioDocument } from '@/lib/studio-document';
import type { Universe } from '@/lib/types';

interface VideoStudioPageProps {
  params: Promise<{ id: string }>;
}

const PIXELS_PER_SECOND = 42;

function assetKind(asset: ProjectAsset): PhoenixTimelineClipKind | null {
  if (asset.mime_type.startsWith('video/')) return 'video';
  if (asset.mime_type.startsWith('audio/')) return 'audio';
  if (asset.mime_type.startsWith('image/')) return 'image';
  return null;
}

function probeMediaDuration(src: string, kind: PhoenixTimelineClipKind): Promise<number> {
  if (kind === 'image') return Promise.resolve(5);
  return new Promise(resolve => {
    const media = document.createElement(kind === 'audio' ? 'audio' : 'video');
    const finish = (value: number) => {
      media.removeAttribute('src');
      media.load();
      resolve(Number.isFinite(value) && value > 0 ? value : 10);
    };
    media.preload = 'metadata';
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish(10);
    media.src = src;
  });
}

export default function VideoStudioPage({ params }: VideoStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [timeline, setTimeline] = useState<PhoenixVideoTimeline | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [snapEditing, setSnapEditing] = useState(true);
  const [rippleEditing, setRippleEditing] = useState(false);
  const visualVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (cancelled) return;
        setProject(loadedProject);
        const localTimeline = loadPhoenixVideoTimeline(id);
        const cloudTimeline = isDbMode() ? await dbGetStudioDocument<PhoenixVideoTimeline>(id, 'video_timeline') : null;
        setTimeline(newestStudioDocument(localTimeline, cloudTimeline) || createPhoenixVideoTimeline(id));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!timeline || loading) return;
    const handle = window.setTimeout(() => {
      const saved = savePhoenixVideoTimeline(timeline);
      if (isDbMode()) {
        void dbSaveStudioDocument(id, 'video_timeline', saved)
          .catch(error => setStatus(error instanceof Error ? error.message : 'Studio Cloud video autosave failed.'));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [timeline, id, loading]);

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

  const activeCaption = useMemo(() => timeline ? activeCaptionAt(timeline, playhead) : null, [timeline, playhead]);

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
      audio.volume = timeline ? timelineClipAudioGainAt(timeline, clip, playhead) : Math.max(0, Math.min(1, clip.volume));
      if (playing) void audio.play().catch(() => undefined);
      else audio.pause();
    }
  }, [activeAudioClips, playhead, playing, timeline]);

  const patchClip = (clipId: string, patch: Partial<PhoenixTimelineClip>) => {
    setTimeline(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip),
      })),
    }) : current);
  };

  const patchTrack = (trackId: string, patch: Partial<PhoenixTimelineTrack>) => {
    setTimeline(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => track.id === trackId ? { ...track, ...patch } : track),
      updatedAt: new Date().toISOString(),
    }) : current);
  };

  const addAsset = async (asset: ProjectAsset) => {
    if (!timeline) return;
    const kind = assetKind(asset);
    if (!kind) return;
    setStatus(`Reading ${asset.name} metadata...`);
    const sourceDuration = await probeMediaDuration(asset.serve_url, kind);
    setTimeline(current => {
      if (!current) return current;
      const targetKind = kind === 'audio' ? 'audio' : 'video';
      const selectedTrack = current.tracks.find(track => track.id === selectedTrackId && track.kind === targetKind);
      const targetTrack = selectedTrack || current.tracks
        .filter(track => track.kind === targetKind)
        .sort((a, b) => a.order - b.order)[0];
      if (!targetTrack) return current;
      setSelectedTrackId(targetTrack.id);
      const insertStart = snapEditing
        ? snapTimelineTime(current, playhead, 0.12)
        : Math.max(0, playhead);
      const clipDuration = Math.max(0.05, sourceDuration);
      const working = rippleEditing
        ? shiftTimelineTrackFrom(current, targetTrack.id, insertStart, clipDuration)
        : current;
      return addClipToTimelineTrack(working, targetTrack.id, {
        assetId: asset.id,
        name: asset.name,
        src: asset.serve_url,
        mimeType: asset.mime_type,
        kind,
        start: insertStart,
        sourceDuration,
        inPoint: 0,
        outPoint: sourceDuration,
        playbackRate: 1,
        volume: 1,
        muted: false,
      });
    });
    setStatus(`Added ${asset.name}`);
  };

  const dropClipOnTrack = (trackId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const clipId = event.dataTransfer.getData('text/plain');
    if (!clipId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const requestedStart = Math.max(0, (event.clientX - bounds.left) / PIXELS_PER_SECOND);
    setTimeline(current => {
      if (!current) return current;
      const targetTrack = current.tracks.find(track => track.id === trackId);
      if (!targetTrack?.clips.some(clip => clip.id === clipId)) {
        setStatus("Cross-track drag is not enabled yet. Drag within the clip's current lane.");
        return current;
      }
      return moveTimelineClip(current, clipId, requestedStart, {
        ripple: rippleEditing,
        snap: snapEditing,
        snapThreshold: 0.12,
      });
    });
    setSelectedClipId(clipId);
  };

  const createTrack = (kind: 'video' | 'audio') => {
    setTimeline(current => {
      if (!current) return current;
      const next = addTimelineTrack(current, kind);
      const created = next.tracks
        .filter(track => track.kind === kind)
        .sort((a, b) => b.order - a.order)[0];
      if (created) setSelectedTrackId(created.id);
      return next;
    });
  };

  const shiftTrack = (trackId: string, direction: -1 | 1) => {
    setTimeline(current => current ? moveTimelineTrack(current, trackId, direction) : current);
  };

  const deleteEmptyTrack = (trackId: string) => {
    setTimeline(current => current ? removeEmptyTimelineTrack(current, trackId) : current);
    if (selectedTrackId === trackId) setSelectedTrackId('');
  };

  const addCaption = () => {
    if (!timeline || !captionText.trim()) return;
    const start = playhead;
    const end = Math.min(duration, start + 3);
    setTimeline(current => current ? ({
      ...current,
      captions: [...current.captions, {
        id: crypto.randomUUID(),
        text: captionText.trim(),
        start,
        end: Math.max(start + 0.5, end),
        position: 'bottom',
        fontSize: 46,
        color: '#ffffff',
        background: 'rgba(0,0,0,0.55)',
      }],
    }) : current);
    setCaptionText('');
  };

  const addTransformKeyframe = () => {
    if (!selectedClip) return;
    const localTime = Math.max(0, playhead - selectedClip.start);
    const frames = [...(selectedClip.keyframes || []).filter(frame => Math.abs(frame.time - localTime) > 0.02), {
      time: localTime,
      transform: { ...selectedClip.transform },
      easing: 'ease-in-out' as const,
    }].sort((a,b) => a.time-b.time);
    patchClip(selectedClip.id, { keyframes: frames });
  };

  const addAudioGainKeyframe = () => {
    if (!selectedClip || selectedClip.kind !== 'audio') return;
    const localTime = Math.max(0, playhead - selectedClip.start);
    const gain = clipVolumeAutomationAt(selectedClip, playhead);
    const gainKeyframes = [...(selectedClip.gainKeyframes || []).filter(frame => Math.abs(frame.time - localTime) > 0.02), {
      time: localTime,
      gain,
      easing: 'ease-in-out' as const,
    }].sort((a, b) => a.time - b.time);
    patchClip(selectedClip.id, { gainKeyframes });
  };

  const moveSelectedToPlayhead = () => {
    if (!selectedClip) return;
    setTimeline(current => current
      ? moveTimelineClip(current, selectedClip.id, playhead, {
          ripple: rippleEditing,
          snap: snapEditing,
          snapThreshold: 0.12,
        })
      : current);
  };

  const deleteClip = () => {
    if (!selectedClip) return;
    setTimeline(current => current ? removeTimelineClip(current, selectedClip.id, rippleEditing) : current);
    setSelectedClipId('');
  };

  const splitSelected = () => {
    if (!timeline || !selectedClip) return;
    setTimeline(splitTimelineClip(timeline, selectedClip.id, playhead));
    setSelectedClipId('');
  };

  const setCanvasPreset = (width: number, height: number) => {
    setTimeline(current => current ? { ...current, width, height } : current);
  };

  const renderWebm = async () => {
    if (!timeline || rendering) return;
    setRendering(true);
    setRenderProgress(0);
    setStatus('Rendering WebM in real time...');
    setPlaying(false);
    try {
      const blob = await renderPhoenixTimelineWebm(timeline, progress => {
        setRenderProgress(Math.round(progress.ratio * 100));
      });
      downloadVideoBlob(blob, timeline.title || 'phoenix-video');
      setStatus('WebM video exported.');
      setRenderProgress(100);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Video render failed.');
    } finally {
      setRendering(false);
    }
  };

  const uploadMedia = async (file: File) => {
    if (!isDbMode()) return;
    setUploading(true);
    setStatus('');
    try {
      await dbUploadAsset(id, file);
      const next = await dbGetAssets(id);
      setAssets(next);
      setStatus(`Uploaded ${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !timeline) {
    return <Navigation><div className="flex min-h-[60vh] items-center justify-center"><Spinner text="Opening Video Studio..." /></div></Navigation>;
  }

  const timelineWidth = Math.max(900, Math.ceil(duration * PIXELS_PER_SECOND) + 120);
  const canvasRatio = timeline.width / timeline.height;

  return (
    <Navigation>
      <Header
        title="Video Studio"
        subtitle={`Timeline production for ${project?.name || 'Phoenix project'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StudioRevisionPanel<PhoenixVideoTimeline>
              projectId={id}
              kind="video_timeline"
              enabled={isDbMode()}
              onRestore={restored => {
                setTimeline(restored);
                setSelectedClipId('');
                setPlaying(false);
                setPlayhead(0);
                setStatus('Video timeline restored from Studio Cloud.');
              }}
              onError={setStatus}
            />
            <Button size="sm" variant={timeline.width > timeline.height ? 'gold' : 'ghost'} onClick={() => setCanvasPreset(1920,1080)}>16:9</Button>
            <Button size="sm" variant={timeline.height > timeline.width ? 'gold' : 'ghost'} onClick={() => setCanvasPreset(1080,1920)}>9:16</Button>
            <Button size="sm" variant={timeline.height === timeline.width ? 'gold' : 'ghost'} onClick={() => setCanvasPreset(1080,1080)}>1:1</Button>
            <Button size="sm" variant={snapEditing ? 'gold' : 'ghost'} onClick={() => setSnapEditing(value => !value)}>Snap</Button>
            <Button size="sm" variant={rippleEditing ? 'gold' : 'ghost'} onClick={() => setRippleEditing(value => !value)}>Ripple</Button>
            <Button size="sm" variant="gold" loading={rendering} onClick={() => void renderWebm()}>
              {rendering ? `Rendering ${renderProgress}%` : 'Export WebM'}
            </Button>
          </div>
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 2xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Tracks</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => createTrack('video')}>+ V</Button>
                <Button size="sm" variant="ghost" onClick={() => createTrack('audio')}>+ A</Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[...timeline.tracks].sort((a, b) => a.order - b.order).map((track, index, ordered) => {
                const peers = timeline.tracks.filter(item => item.kind === track.kind);
                const canRemove = track.clips.length === 0 && peers.length > 1;
                return (
                  <div key={track.id} className={`rounded-lg border p-2 ${selectedTrackId === track.id ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-white/10 bg-white/[0.02]'}`}>
                    <button type="button" onClick={() => setSelectedTrackId(track.id)} className="flex w-full items-center justify-between gap-2 text-left">
                      <span className="truncate text-xs font-bold text-white">{track.name}</span>
                      <span className="text-[9px] uppercase text-slate-500">{track.kind} · {track.clips.length}</span>
                    </button>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => shiftTrack(track.id, -1)}>↑</Button>
                      <Button size="sm" variant="ghost" disabled={index === ordered.length - 1} onClick={() => shiftTrack(track.id, 1)}>↓</Button>
                      <Button size="sm" variant="ghost" disabled={!canRemove} onClick={() => deleteEmptyTrack(track.id)}>×</Button>
                    </div>
                    {track.kind === 'audio' && (
                      <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
                        <label className="block text-[9px] uppercase text-slate-500">Role
                          <select
                            value={track.role || 'other'}
                            onChange={event => patchTrack(track.id, { role: event.target.value as PhoenixTimelineTrackRole })}
                            className="mt-1 min-h-8 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-[10px] text-white"
                          >
                            <option value="other">Other</option>
                            <option value="dialogue">Dialogue</option>
                            <option value="music">Music</option>
                            <option value="sfx">SFX</option>
                          </select>
                        </label>
                        {track.role === 'music' && (
                          <div className="rounded border border-emerald-400/10 bg-emerald-400/[0.03] p-2">
                            <Button
                              size="sm"
                              variant={track.ducking?.enabled ? 'gold' : 'ghost'}
                              className="w-full"
                              onClick={() => patchTrack(track.id, {
                                ducking: track.ducking?.enabled
                                  ? { ...track.ducking, enabled: false }
                                  : (track.ducking || { enabled: true, level: 0.3, attack: 0.2, release: 0.45 }),
                              })}
                            >
                              {track.ducking?.enabled ? 'Auto Duck On' : 'Enable Auto Duck'}
                            </Button>
                            {track.ducking?.enabled && (
                              <div className="mt-2 grid grid-cols-3 gap-1">
                                <label className="text-[8px] uppercase text-slate-500">Level
                                  <input type="number" min={0} max={1} step={0.05} value={track.ducking.level} onChange={event => patchTrack(track.id, { ducking: { ...track.ducking!, level: Math.max(0, Math.min(1, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-1 text-[9px] text-white" />
                                </label>
                                <label className="text-[8px] uppercase text-slate-500">Attack
                                  <input type="number" min={0} max={5} step={0.05} value={track.ducking.attack} onChange={event => patchTrack(track.id, { ducking: { ...track.ducking!, attack: Math.max(0, Math.min(5, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-1 text-[9px] text-white" />
                                </label>
                                <label className="text-[8px] uppercase text-slate-500">Release
                                  <input type="number" min={0} max={5} step={0.05} value={track.ducking.release} onChange={event => patchTrack(track.id, { ducking: { ...track.ducking!, release: Math.max(0, Math.min(5, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-1 text-[9px] text-white" />
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">Select a matching track before placing media. Higher tracks composite above lower tracks during preview and WebM export.</p>
          </div>

          <div className="mb-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Media</p>
            {isDbMode() && (
              <>
                <input
                  id="video-studio-upload"
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/wav,audio/mpeg"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void uploadMedia(file);
                    event.currentTarget.value = '';
                  }}
                />
                <Button size="sm" variant="gold" loading={uploading} className="mb-3 w-full" onClick={() => document.getElementById('video-studio-upload')?.click()}>
                  Upload Media
                </Button>
              </>
            )}
            {status && <p className="mb-3 text-xs leading-5 text-slate-400">{status}</p>}
            <div className="space-y-2">
              {assets.filter(asset => assetKind(asset)).map(asset => {
                const kind = assetKind(asset)!;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => void addAsset(asset)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-left hover:border-blue-400/40"
                  >
                    <span className="text-lg">{kind === 'video' ? '🎬' : kind === 'audio' ? '♫' : '▧'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">{asset.name}</span>
                      <span className="block text-[10px] uppercase text-slate-500">{kind}</span>
                    </span>
                  </button>
                );
              })}
              {assets.length === 0 && <p className="text-xs leading-5 text-slate-500">Upload images, MP4/WebM clips, or WAV/MP3 audio to begin.</p>}
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-[#04060b]">
          <section className="border-b border-white/10 p-4 md:p-6">
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <div
                className="relative flex max-h-[460px] w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black"
                style={{ aspectRatio: canvasRatio }}
              >
                {activeVisualLayers.length === 0 && <div className="text-sm text-slate-600">No visual clip at {playhead.toFixed(2)}s</div>}
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
                    transform: `translate(${((transform.x / Math.max(1, timeline.width)) + transition.x) * 100}%, ${((transform.y / Math.max(1, timeline.height)) + transition.y) * 100}%) scale(${transform.scale * transition.scale}) rotate(${transform.rotation}deg)`,
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
                        playsInline
                        muted
                        preload="metadata"
                        style={layerStyle}
                      />
                    );
                  }
                  return null;
                })}
                {activeCaption && (
                  <div
                    className={`pointer-events-none absolute left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded px-4 py-2 text-center font-bold ${activeCaption.position === 'top' ? 'top-[8%]' : activeCaption.position === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[8%]'}`}
                    style={{
                      color: activeCaption.color,
                      background: activeCaption.background,
                      fontSize: Math.max(14, activeCaption.fontSize * Math.min(1, 720 / timeline.width)),
                    }}
                  >
                    {activeCaption.text}
                  </div>
                )}
                {activeAudioClips.map(clip => (
                  <audio
                    ref={element => {
                      if (element) audioRefs.current.set(clip.id, element);
                      else audioRefs.current.delete(clip.id);
                    }}
                    key={clip.id}
                    src={clip.src}
                    preload="metadata"
                  />
                ))}
              </div>

              <div className="mt-4 flex w-full items-center gap-3">
                <Button size="sm" variant={playing ? 'gold' : 'secondary'} onClick={() => {
                  if (playhead >= duration) setPlayhead(0);
                  setPlaying(value => !value);
                }}>
                  {playing ? 'Pause' : 'Play'}
                </Button>
                <input type="range" min={0} max={duration} step={0.01} value={Math.min(playhead,duration)} onChange={event => {
                  setPlaying(false);
                  setPlayhead(Number(event.target.value));
                }} className="flex-1" />
                <span className="w-28 text-right font-mono text-xs text-slate-400">{playhead.toFixed(2)} / {duration.toFixed(2)}s</span>
              </div>
            </div>
          </section>

          <section className="overflow-auto p-4">
            <div className="relative" style={{ width: timelineWidth }}>
              <div className="ml-28 h-7 border-b border-white/10">
                {Array.from({ length: Math.ceil(duration) + 1 }, (_, second) => (
                  <span key={second} className="absolute top-0 text-[9px] text-slate-600" style={{ left: 112 + second * PIXELS_PER_SECOND }}>
                    {second}s
                  </span>
                ))}
              </div>
              {[...timeline.tracks].sort((a,b) => a.order-b.order).map(track => (
                <div key={track.id} className="relative flex h-20 border-b border-white/5">
                  <button
                    type="button"
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`sticky left-0 z-20 flex w-28 shrink-0 items-center border-r px-3 text-left text-xs font-bold ${selectedTrackId === track.id ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-[#080c15] text-slate-400'}`}
                  >
                    {track.name}
                  </button>
                  <div
                    className="relative h-full flex-1 bg-[#060911]"
                    onDragOver={event => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={event => dropClipOnTrack(track.id, event)}
                  >
                    {track.clips.map(clip => {
                      const clipDuration = timelineClipDuration(clip);
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          draggable
                          onDragStart={event => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', clip.id);
                            setSelectedClipId(clip.id);
                          }}
                          onClick={() => setSelectedClipId(clip.id)}
                          className={`absolute top-2 h-16 cursor-grab overflow-hidden rounded border px-2 text-left active:cursor-grabbing ${selectedClipId === clip.id ? 'border-blue-300 bg-blue-500/25' : track.kind === 'audio' ? 'border-violet-400/30 bg-violet-500/15' : 'border-blue-400/30 bg-blue-500/15'}`}
                          style={{ left: clip.start * PIXELS_PER_SECOND, width: Math.max(34, clipDuration * PIXELS_PER_SECOND) }}
                        >
                          <span className="block truncate text-[10px] font-bold text-white">{clip.name}</span>
                          <span className="block text-[9px] text-slate-400">{clipDuration.toFixed(2)}s</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-red-400" style={{ left: 112 + playhead * PIXELS_PER_SECOND }} />
            </div>
          </section>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Caption</p>
            <textarea
              value={captionText}
              onChange={event => setCaptionText(event.target.value)}
              placeholder="Type a caption at the playhead…"
              className="min-h-20 w-full rounded border border-white/10 bg-black/20 p-2 text-sm text-white"
            />
            <Button size="sm" variant="secondary" className="mt-2 w-full" disabled={!captionText.trim()} onClick={addCaption}>
              Add 3s Caption
            </Button>
            {timeline.captions.length > 0 && (
              <div className="mt-3 space-y-1">
                {timeline.captions.slice().sort((a,b)=>a.start-b.start).map(cue => (
                  <button
                    key={cue.id}
                    type="button"
                    onClick={() => setPlayhead(cue.start)}
                    className="flex min-h-10 w-full items-center justify-between rounded border border-white/5 px-2 text-left text-[10px] text-slate-400 hover:border-white/15"
                  >
                    <span className="truncate">{cue.text}</span>
                    <span>{cue.start.toFixed(1)}s</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Clip Inspector</p>
          {!selectedClip ? (
            <p className="text-xs leading-5 text-slate-500">Select a timeline clip to trim, move, split, mute, or change playback speed.</p>
          ) : (
            <div className="space-y-3">
              <div className="truncate text-sm font-bold text-white">{selectedClip.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase text-slate-500">Start
                  <input type="number" min={0} step={0.05} value={selectedClip.start} onChange={event => setTimeline(current => current ? moveTimelineClip(current, selectedClip.id, Number(event.target.value), { snap: snapEditing, snapThreshold: 0.12 }) : current)} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">Rate
                  <input type="number" min={0.25} max={4} step={0.05} value={selectedClip.playbackRate} onChange={event => patchClip(selectedClip.id,{playbackRate:Math.max(0.25,Math.min(4,Number(event.target.value)))})} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">In
                  <input type="number" min={0} max={selectedClip.outPoint} step={0.05} value={selectedClip.inPoint} onChange={event => patchClip(selectedClip.id,{inPoint:Math.max(0,Math.min(selectedClip.outPoint-0.05,Number(event.target.value)))})} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">Out
                  <input type="number" min={selectedClip.inPoint+0.05} max={selectedClip.sourceDuration} step={0.05} value={selectedClip.outPoint} onChange={event => patchClip(selectedClip.id,{outPoint:Math.min(selectedClip.sourceDuration,Math.max(selectedClip.inPoint+0.05,Number(event.target.value)))})} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
              </div>
              <label className="block text-[10px] uppercase text-slate-500">Volume {Math.round(selectedClip.volume*100)}%
                <input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={event => patchClip(selectedClip.id,{volume:Number(event.target.value)})} className="mt-1 w-full" />
              </label>

              {selectedClip.kind === 'audio' && (
                <>
                  <AudioWaveform src={selectedClip.src} />
                  <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Gain Automation</span>
                      <Button size="sm" variant="ghost" onClick={addAudioGainKeyframe}>+ Keyframe</Button>
                    </div>
                    {(selectedClip.gainKeyframes || []).length === 0 ? (
                      <p className="mt-2 text-[10px] leading-4 text-slate-500">Add volume keyframes at the playhead for dialogue rides, music ducks, and SFX emphasis.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {[...(selectedClip.gainKeyframes || [])].sort((a, b) => a.time - b.time).map((frame, index) => (
                          <div key={frame.time + '-' + index} className="grid grid-cols-[58px_70px_1fr_auto] items-center gap-2 rounded border border-white/5 bg-black/10 p-2">
                            <span className="font-mono text-[9px] text-slate-500">{frame.time.toFixed(2)}s</span>
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={frame.gain}
                              onChange={event => patchClip(selectedClip.id, {
                                gainKeyframes: (selectedClip.gainKeyframes || []).map(item => item === frame ? { ...item, gain: Math.max(0, Math.min(1, Number(event.target.value))) } : item),
                              })}
                              className="min-w-0 rounded border border-white/10 bg-black/20 p-1 text-[10px] text-white"
                              aria-label={'Gain keyframe ' + (index + 1)}
                            />
                            <select
                              value={frame.easing || 'linear'}
                              onChange={event => patchClip(selectedClip.id, {
                                gainKeyframes: (selectedClip.gainKeyframes || []).map(item => item === frame ? { ...item, easing: event.target.value as typeof frame.easing } : item),
                              })}
                              className="min-h-8 min-w-0 rounded border border-white/10 bg-[#0a0d14] px-2 text-[9px] text-white"
                            >
                              <option value="linear">Linear</option>
                              <option value="ease-in">Ease In</option>
                              <option value="ease-out">Ease Out</option>
                              <option value="ease-in-out">Ease In/Out</option>
                              <option value="hold">Hold</option>
                            </select>
                            <Button size="sm" variant="ghost" onClick={() => patchClip(selectedClip.id, {
                              gainKeyframes: (selectedClip.gainKeyframes || []).filter(item => item !== frame),
                            })}>×</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase text-slate-500">Transition In
                  <select value={selectedClip.transitionIn} onChange={event => patchClip(selectedClip.id,{transitionIn:event.target.value as PhoenixTimelineClip['transitionIn']})} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] p-2 text-white">
                    <option value="none">None</option>
                    <option value="fade">Fade</option>
                    {selectedClip.kind !== 'audio' && <option value="slide-left">Slide Left</option>}
                    {selectedClip.kind !== 'audio' && <option value="slide-right">Slide Right</option>}
                    {selectedClip.kind !== 'audio' && <option value="zoom">Zoom</option>}
                  </select>
                </label>
                <label className="text-[10px] uppercase text-slate-500">Transition Out
                  <select value={selectedClip.transitionOut} onChange={event => patchClip(selectedClip.id,{transitionOut:event.target.value as PhoenixTimelineClip['transitionOut']})} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] p-2 text-white">
                    <option value="none">None</option>
                    <option value="fade">Fade</option>
                    {selectedClip.kind !== 'audio' && <option value="slide-left">Slide Left</option>}
                    {selectedClip.kind !== 'audio' && <option value="slide-right">Slide Right</option>}
                    {selectedClip.kind !== 'audio' && <option value="zoom">Zoom</option>}
                  </select>
                </label>
              </div>
              <label className="block text-[10px] uppercase text-slate-500">Transition Duration
                <input type="number" min={0.05} max={5} step={0.05} value={selectedClip.transitionDuration} onChange={event => patchClip(selectedClip.id,{transitionDuration:Math.max(0.05,Number(event.target.value))})} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
              </label>

              <div className="rounded-lg border border-blue-400/15 bg-blue-400/[0.04] p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-300">Transform</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['scale','x','y','rotation'] as const).map(key => (
                    <label key={key} className="text-[10px] uppercase text-slate-500">{key}
                      <input
                        type="number"
                        step={key === 'scale' ? 0.05 : 1}
                        value={selectedClip.transform[key]}
                        onChange={event => patchClip(selectedClip.id,{transform:{...selectedClip.transform,[key]:Number(event.target.value)}})}
                        className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 rounded border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Depth Parallax</span>
                    <Button
                      size="sm"
                      variant={selectedClip.parallax?.enabled ? 'gold' : 'ghost'}
                      onClick={() => patchClip(selectedClip.id, {
                        parallax: selectedClip.parallax?.enabled
                          ? { ...selectedClip.parallax, enabled: false }
                          : (selectedClip.parallax || { enabled: true, depth: 0.65, driftX: 80, driftY: 0, zoom: 0.12 }),
                      })}
                    >
                      {selectedClip.parallax?.enabled ? 'On' : 'Enable'}
                    </Button>
                  </div>
                  {selectedClip.parallax?.enabled && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-[9px] uppercase text-slate-500">Depth
                        <input type="number" min={0} max={1} step={0.05} value={selectedClip.parallax.depth} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, depth: Math.max(0, Math.min(1, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-xs text-white" />
                      </label>
                      <label className="text-[9px] uppercase text-slate-500">Zoom
                        <input type="number" min={-0.5} max={0.5} step={0.01} value={selectedClip.parallax.zoom} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, zoom: Math.max(-0.5, Math.min(0.5, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-xs text-white" />
                      </label>
                      <label className="text-[9px] uppercase text-slate-500">Drift X
                        <input type="number" min={-2000} max={2000} step={5} value={selectedClip.parallax.driftX} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, driftX: Math.max(-2000, Math.min(2000, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-xs text-white" />
                      </label>
                      <label className="text-[9px] uppercase text-slate-500">Drift Y
                        <input type="number" min={-2000} max={2000} step={5} value={selectedClip.parallax.driftY} onChange={event => patchClip(selectedClip.id, { parallax: { ...selectedClip.parallax!, driftY: Math.max(-2000, Math.min(2000, Number(event.target.value))) } })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-xs text-white" />
                      </label>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={addTransformKeyframe}>Add Keyframe at Playhead</Button>
                {selectedClip.keyframes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {[...selectedClip.keyframes].sort((a, b) => a.time - b.time).map((frame, index) => (
                      <div key={frame.time + '-' + index} className="grid grid-cols-[70px_1fr] items-center gap-2 rounded border border-white/5 bg-black/10 p-2">
                        <span className="font-mono text-[10px] text-slate-500">{frame.time.toFixed(2)}s</span>
                        <select
                          value={frame.easing || 'linear'}
                          onChange={event => patchClip(selectedClip.id, {
                            keyframes: selectedClip.keyframes.map(item => item === frame ? { ...item, easing: event.target.value as typeof frame.easing } : item),
                          })}
                          className="min-h-8 rounded border border-white/10 bg-[#0a0d14] px-2 text-[10px] text-white"
                        >
                          <option value="linear">Linear</option>
                          <option value="ease-in">Ease In</option>
                          <option value="ease-out">Ease Out</option>
                          <option value="ease-in-out">Ease In/Out</option>
                          <option value="hold">Hold</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button size="sm" variant="ghost" className="w-full" onClick={() => patchClip(selectedClip.id,{muted:!selectedClip.muted})}>{selectedClip.muted ? 'Unmute' : 'Mute'}</Button>
              <Button size="sm" variant="secondary" className="w-full" onClick={moveSelectedToPlayhead}>{rippleEditing ? 'Ripple Move to Playhead' : 'Move to Playhead'}</Button>
              <Button size="sm" variant="secondary" className="w-full" onClick={splitSelected}>Split at Playhead</Button>
              <Button size="sm" variant="danger" className="w-full" onClick={deleteClip}>{rippleEditing ? 'Ripple Delete Clip' : 'Delete Clip'}</Button>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
            <div className="text-xs font-bold text-amber-200">Timeline foundation</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Real media ingest, preview, timing, trim, split, speed, volume, and vertical-video canvases are active.
              Captions, audio waveforms, fade transitions, transform keyframes, and browser-native WebM rendering are active.
              Richer compositing/effects and server-side MP4/H.264 transcode are the next video-engine tier.
            </p>
          </div>
        </aside>
      </div>
    </Navigation>
  );
}
