'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
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
  addClipToTimeline,
  clipTransitionOpacity,
  clipTransformAt,
  createPhoenixVideoTimeline,
  loadPhoenixVideoTimeline,
  savePhoenixVideoTimeline,
  splitTimelineClip,
  timelineClipDuration,
  timelineDuration,
  type PhoenixTimelineClip,
  type PhoenixTimelineClipKind,
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
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const activeVisualClip = useMemo(() => {
    if (!timeline) return null;
    const clips = timeline.tracks
      .filter(track => track.kind === 'video')
      .flatMap(track => track.clips)
      .filter(clip => playhead >= clip.start && playhead <= clip.start + timelineClipDuration(clip))
      .sort((a, b) => b.start - a.start);
    return clips[0] || null;
  }, [timeline, playhead]);

  const activeCaption = useMemo(() => timeline ? activeCaptionAt(timeline, playhead) : null, [timeline, playhead]);

  const activeVisualTransform = useMemo(
    () => activeVisualClip ? clipTransformAt(activeVisualClip, playhead) : null,
    [activeVisualClip, playhead],
  );

  const activeVisualOpacity = useMemo(
    () => activeVisualClip ? clipTransitionOpacity(activeVisualClip, playhead) : 1,
    [activeVisualClip, playhead],
  );

  const activeAudioClip = useMemo(() => {
    if (!timeline) return null;
    const clips = timeline.tracks
      .filter(track => track.kind === 'audio')
      .flatMap(track => track.clips)
      .filter(clip => playhead >= clip.start && playhead <= clip.start + timelineClipDuration(clip))
      .sort((a, b) => b.start - a.start);
    return clips[0] || null;
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
    const clip = activeVisualClip;
    const video = videoRef.current;
    if (!clip || clip.kind !== 'video' || !video) return;
    const sourceTime = clip.inPoint + Math.max(0, playhead - clip.start) * clip.playbackRate;
    if (Number.isFinite(video.duration) && Math.abs(video.currentTime - sourceTime) > 0.3) {
      video.currentTime = Math.min(sourceTime, Math.max(0, video.duration - 0.05));
    }
    video.playbackRate = clip.playbackRate;
    video.volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume));
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [activeVisualClip, playhead, playing]);

  useEffect(() => {
    const clip = activeAudioClip;
    const audio = audioRef.current;
    if (!clip || !audio) return;
    const sourceTime = clip.inPoint + Math.max(0, playhead - clip.start) * clip.playbackRate;
    if (Number.isFinite(audio.duration) && Math.abs(audio.currentTime - sourceTime) > 0.3) {
      audio.currentTime = Math.min(sourceTime, Math.max(0, audio.duration - 0.05));
    }
    audio.playbackRate = clip.playbackRate;
    audio.volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume));
    if (playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [activeAudioClip, playhead, playing]);

  const patchClip = (clipId: string, patch: Partial<PhoenixTimelineClip>) => {
    setTimeline(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip),
      })),
    }) : current);
  };

  const addAsset = async (asset: ProjectAsset) => {
    if (!timeline) return;
    const kind = assetKind(asset);
    if (!kind) return;
    setStatus(`Reading ${asset.name} metadata...`);
    const sourceDuration = await probeMediaDuration(asset.serve_url, kind);
    setTimeline(current => current ? addClipToTimeline(current, {
      assetId: asset.id,
      name: asset.name,
      src: asset.serve_url,
      mimeType: asset.mime_type,
      kind,
      start: kind === 'audio' ? 0 : Math.max(0, timelineDuration(current) - 1),
      sourceDuration,
      inPoint: 0,
      outPoint: sourceDuration,
      playbackRate: 1,
      volume: 1,
      muted: false,
    }) : current);
    setStatus(`Added ${asset.name}`);
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
    }].sort((a,b) => a.time-b.time);
    patchClip(selectedClip.id, { keyframes: frames });
  };

  const deleteClip = () => {
    if (!selectedClip) return;
    setTimeline(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => clip.id !== selectedClip.id),
      })),
    }) : current);
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
            <Button size="sm" variant="gold" loading={rendering} onClick={() => void renderWebm()}>
              {rendering ? `Rendering ${renderProgress}%` : 'Export WebM'}
            </Button>
          </div>
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 2xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
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
                {!activeVisualClip && <div className="text-sm text-slate-600">No visual clip at {playhead.toFixed(2)}s</div>}
                {activeVisualClip?.kind === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeVisualClip.src}
                    alt=""
                    className="h-full w-full object-contain"
                    style={{
                      opacity: activeVisualOpacity,
                      transform: activeVisualTransform
                        ? `translate(${activeVisualTransform.x}px, ${activeVisualTransform.y}px) scale(${activeVisualTransform.scale}) rotate(${activeVisualTransform.rotation}deg)`
                        : undefined,
                    }}
                  />
                )}
                {activeVisualClip?.kind === 'video' && (
                  <video
                    ref={videoRef}
                    key={activeVisualClip.id}
                    src={activeVisualClip.src}
                    className="h-full w-full object-contain"
                    playsInline
                    style={{
                      opacity: activeVisualOpacity,
                      transform: activeVisualTransform
                        ? `translate(${activeVisualTransform.x}px, ${activeVisualTransform.y}px) scale(${activeVisualTransform.scale}) rotate(${activeVisualTransform.rotation}deg)`
                        : undefined,
                    }}
                  />
                )}
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
                {activeAudioClip && <audio ref={audioRef} key={activeAudioClip.id} src={activeAudioClip.src} preload="metadata" />}
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
                  <div className="sticky left-0 z-20 flex w-28 shrink-0 items-center border-r border-white/10 bg-[#080c15] px-3 text-xs font-bold text-slate-400">
                    {track.name}
                  </div>
                  <div className="relative h-full flex-1 bg-[#060911]">
                    {track.clips.map(clip => {
                      const clipDuration = timelineClipDuration(clip);
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => setSelectedClipId(clip.id)}
                          className={`absolute top-2 h-16 overflow-hidden rounded border px-2 text-left ${selectedClipId === clip.id ? 'border-blue-300 bg-blue-500/25' : track.kind === 'audio' ? 'border-violet-400/30 bg-violet-500/15' : 'border-blue-400/30 bg-blue-500/15'}`}
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
                  <input type="number" min={0} step={0.05} value={selectedClip.start} onChange={event => patchClip(selectedClip.id,{start:Math.max(0,Number(event.target.value))})} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
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

              {selectedClip.kind === 'audio' && <AudioWaveform src={selectedClip.src} />}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase text-slate-500">Fade In
                  <select value={selectedClip.transitionIn} onChange={event => patchClip(selectedClip.id,{transitionIn:event.target.value as PhoenixTimelineClip['transitionIn']})} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] p-2 text-white">
                    <option value="none">None</option>
                    <option value="fade">Fade</option>
                  </select>
                </label>
                <label className="text-[10px] uppercase text-slate-500">Fade Out
                  <select value={selectedClip.transitionOut} onChange={event => patchClip(selectedClip.id,{transitionOut:event.target.value as PhoenixTimelineClip['transitionOut']})} className="mt-1 min-h-10 w-full rounded border border-white/10 bg-[#0a0d14] p-2 text-white">
                    <option value="none">None</option>
                    <option value="fade">Fade</option>
                  </select>
                </label>
              </div>
              <label className="block text-[10px] uppercase text-slate-500">Fade Duration
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
                <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={addTransformKeyframe}>Add Keyframe at Playhead</Button>
                {selectedClip.keyframes.length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-500">{selectedClip.keyframes.length} transform keyframe{selectedClip.keyframes.length === 1 ? '' : 's'}</div>
                )}
              </div>

              <Button size="sm" variant="ghost" className="w-full" onClick={() => patchClip(selectedClip.id,{muted:!selectedClip.muted})}>{selectedClip.muted ? 'Unmute' : 'Mute'}</Button>
              <Button size="sm" variant="secondary" className="w-full" onClick={splitSelected}>Split at Playhead</Button>
              <Button size="sm" variant="danger" className="w-full" onClick={deleteClip}>Delete Clip</Button>
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
