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
  addAudioClip,
  audioClipDuration,
  audioMixDuration,
  createPhoenixAudioMix,
  loadPhoenixAudioMix,
  savePhoenixAudioMix,
  type PhoenixAudioClip,
  type PhoenixAudioMix,
} from '@/lib/audio-mix';
import { downloadAudioBlob, exportPhoenixAudioMixWav } from '@/lib/audio-renderer';
import { loadMotionComicTimeline, saveMotionComicTimeline } from '@/lib/motion-comic';
import {
  createPhoenixVideoTimeline,
  loadPhoenixVideoTimeline,
  replaceSyncedAudioMixClip,
  savePhoenixVideoTimeline,
  type PhoenixVideoTimeline,
} from '@/lib/video-timeline';
import { newestStudioDocument } from '@/lib/studio-document';
import type { Universe } from '@/lib/types';

interface AudioStudioPageProps {
  params: Promise<{ id: string }>;
}

const PIXELS_PER_SECOND = 44;

function probeAudioDuration(src: string): Promise<number> {
  return new Promise(resolve => {
    const audio = document.createElement('audio');
    const finish = (value: number) => {
      audio.removeAttribute('src');
      audio.load();
      resolve(Number.isFinite(value) && value > 0 ? value : 10);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(10);
    audio.src = src;
  });
}

export default function AudioStudioPage({ params }: AudioStudioPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [mix, setMix] = useState<PhoenixAudioMix | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [rendering, setRendering] = useState(false);
  const [syncingTarget, setSyncingTarget] = useState<'video_timeline' | 'motion_timeline' | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (cancelled) return;
        setProject(loadedProject);
        const localMix = loadPhoenixAudioMix(id);
        const cloudMix = isDbMode() ? await dbGetStudioDocument<PhoenixAudioMix>(id, 'audio_mix') : null;
        setMix(newestStudioDocument(localMix, cloudMix) || createPhoenixAudioMix(id));
        if (isDbMode()) setAssets(await dbGetAssets(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!mix || loading) return;
    const handle = window.setTimeout(() => {
      const saved = savePhoenixAudioMix(mix);
      if (isDbMode()) {
        void dbSaveStudioDocument(id, 'audio_mix', saved)
          .catch(error => setStatus(error instanceof Error ? error.message : 'Studio Cloud audio autosave failed.'));
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [mix, id, loading]);

  const duration = useMemo(() => mix ? audioMixDuration(mix) : 1, [mix]);
  const selectedClip = useMemo(
    () => mix?.tracks.flatMap(track => track.clips).find(clip => clip.id === selectedClipId) || null,
    [mix, selectedClipId],
  );

  const patchClip = (clipId: string, patch: Partial<PhoenixAudioClip>) => {
    setMix(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip),
      })),
    }) : current);
  };

  const patchTrack = (trackId: string, patch: Partial<PhoenixAudioMix['tracks'][number]>) => {
    setMix(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => track.id === trackId ? { ...track, ...patch } : track),
    }) : current);
  };

  const addAssetToTrack = async (asset: ProjectAsset, trackId: string) => {
    if (!mix) return;
    setStatus(`Reading ${asset.name} metadata...`);
    const sourceDuration = await probeAudioDuration(asset.serve_url);
    setMix(current => current ? addAudioClip(current, trackId, {
      assetId: asset.id,
      name: asset.name,
      src: asset.serve_url,
      mimeType: asset.mime_type,
      start: 0,
      sourceDuration,
      inPoint: 0,
      outPoint: sourceDuration,
      playbackRate: 1,
      volume: 1,
      pan: 0,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
    }) : current);
    setStatus(`Added ${asset.name}`);
  };

  const uploadAudio = async (file: File) => {
    if (!isDbMode()) return;
    setUploading(true);
    setStatus('');
    try {
      await dbUploadAsset(id, file);
      setAssets(await dbGetAssets(id));
      setStatus(`Uploaded ${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    setMix(current => current ? ({
      ...current,
      tracks: current.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => clip.id !== selectedClip.id),
      })),
    }) : current);
    setSelectedClipId('');
  };

  useEffect(() => {
    const audio = previewRef.current;
    if (!audio || !selectedClip) return;
    audio.playbackRate = selectedClip.playbackRate;
    audio.volume = selectedClip.muted ? 0 : Math.max(0, Math.min(1, selectedClip.volume));
  }, [selectedClip]);

  const renderMix = async () => {
    if (!mix || rendering) return;
    setRendering(true);
    setStatus('Rendering WAV mix...');
    try {
      const blob = await exportPhoenixAudioMixWav(mix);
      downloadAudioBlob(blob, mix.title || 'phoenix-audio');
      setStatus('WAV mix exported.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Audio render failed.');
    } finally {
      setRendering(false);
    }
  };


  const syncMixToTimeline = async (target: 'video_timeline' | 'motion_timeline') => {
    if (!mix || syncingTarget) return;
    if (!isDbMode()) {
      setStatus('Send Mix requires Studio Cloud mode so the rendered WAV can become a durable project asset.');
      return;
    }
    setSyncingTarget(target);
    setStatus(target === 'video_timeline' ? 'Rendering mix for Video Studio…' : 'Rendering mix for Motion Comic…');
    try {
      const blob = await exportPhoenixAudioMixWav(mix);
      const safeTitle = (mix.title || 'phoenix-audio')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'phoenix-audio';
      const asset = await dbUploadAsset(id, new File([blob], `${safeTitle}-mix.wav`, { type: 'audio/wav' }));
      const mixDuration = audioMixDuration(mix);

      let timeline: PhoenixVideoTimeline | null = null;
      if (target === 'video_timeline') {
        const local = loadPhoenixVideoTimeline(id);
        const cloud = await dbGetStudioDocument<PhoenixVideoTimeline>(id, target);
        timeline = newestStudioDocument(local, cloud) || createPhoenixVideoTimeline(id);
      } else {
        const local = loadMotionComicTimeline(id);
        const cloud = await dbGetStudioDocument<PhoenixVideoTimeline>(id, target);
        timeline = newestStudioDocument(local, cloud);
        if (!timeline) {
          throw new Error('Build a Motion Comic timeline first, then send this audio mix to it.');
        }
      }

      const next = replaceSyncedAudioMixClip(timeline, {
        assetId: asset.id,
        src: asset.serve_url || `/api/db/assets/${asset.id}/serve`,
        name: `${mix.title || 'Phoenix Audio'} — Synced Mix`,
        duration: mixDuration,
      });
      const saved = target === 'video_timeline'
        ? savePhoenixVideoTimeline(next)
        : saveMotionComicTimeline(next);
      await dbSaveStudioDocument(id, target, saved);
      setAssets(await dbGetAssets(id));
      setStatus(target === 'video_timeline'
        ? 'Synced rendered mix to Video Studio. The previous synced mix clip was replaced.'
        : 'Synced rendered mix to Motion Comic Studio. The previous synced mix clip was replaced.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to sync audio mix.');
    } finally {
      setSyncingTarget(null);
    }
  };

  if (loading || !mix) {
    return (
      <Navigation>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner text="Opening Audio Studio..." />
        </div>
      </Navigation>
    );
  }

  const timelineWidth = Math.max(900, Math.ceil(duration * PIXELS_PER_SECOND) + 140);
  const audioAssets = assets.filter(asset => asset.mime_type.startsWith('audio/'));

  return (
    <Navigation>
      <Header
        title="Audio Studio"
        subtitle={`Voice, music, SFX, and mix timing for ${project?.name || 'Phoenix project'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StudioRevisionPanel<PhoenixAudioMix>
              projectId={id}
              kind="audio_mix"
              enabled={isDbMode()}
              onRestore={restored => {
                setMix(restored);
                setSelectedClipId('');
                setStatus('Audio mix restored from Studio Cloud.');
              }}
              onError={setStatus}
            />
            <Button size="sm" variant="secondary" loading={syncingTarget === 'video_timeline'} onClick={() => void syncMixToTimeline('video_timeline')}>
              Send Mix to Video
            </Button>
            <Button size="sm" variant="secondary" loading={syncingTarget === 'motion_timeline'} onClick={() => void syncMixToTimeline('motion_timeline')}>
              Send Mix to Motion
            </Button>
            <Button size="sm" variant="gold" loading={rendering} onClick={() => void renderMix()}>
              Export WAV Mix
            </Button>
          </div>
        }
      />

      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 2xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="border-r border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Audio Assets</p>
          {isDbMode() && (
            <>
              <input
                id="audio-studio-upload"
                type="file"
                className="hidden"
                accept="audio/wav,audio/mpeg"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAudio(file);
                  event.currentTarget.value = '';
                }}
              />
              <Button size="sm" variant="gold" loading={uploading} className="mb-3 w-full" onClick={() => document.getElementById('audio-studio-upload')?.click()}>
                Upload WAV / MP3
              </Button>
            </>
          )}
          {status && <p className="mb-3 text-xs leading-5 text-slate-400">{status}</p>}

          <div className="space-y-3">
            {audioAssets.map(asset => (
              <div key={asset.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="truncate text-xs font-bold text-white">{asset.name}</div>
                <div className="mt-2"><AudioWaveform src={asset.serve_url} height={42} /></div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {mix.tracks.map(track => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => void addAssetToTrack(asset, track.id)}
                      className="min-h-9 rounded border border-white/10 px-1 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400/40 hover:text-blue-200"
                    >
                      + {track.role}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {audioAssets.length === 0 && (
              <p className="text-xs leading-5 text-slate-500">Upload WAV or MP3 files to build narration, music, and SFX tracks.</p>
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-[#04060b] p-4">
          <div className="mb-4 rounded-xl border border-white/10 bg-[#080c15] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">{mix.title}</div>
                <div className="text-xs text-slate-500">{duration.toFixed(2)} seconds · {mix.tracks.reduce((count, track) => count + track.clips.length, 0)} clips</div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Autosaved project mix</div>
            </div>
          </div>

          <section className="overflow-auto rounded-xl border border-white/10 bg-[#060911]">
            <div className="relative" style={{ width: timelineWidth }}>
              <div className="ml-36 h-7 border-b border-white/10">
                {Array.from({ length: Math.ceil(duration) + 1 }, (_, second) => (
                  <span key={second} className="absolute top-1 text-[9px] text-slate-600" style={{ left: 144 + second * PIXELS_PER_SECOND }}>
                    {second}s
                  </span>
                ))}
              </div>

              {[...mix.tracks].sort((a, b) => a.order - b.order).map(track => (
                <div key={track.id} className="relative flex min-h-24 border-b border-white/5">
                  <div className="sticky left-0 z-20 w-36 shrink-0 border-r border-white/10 bg-[#080c15] p-3">
                    <div className="text-xs font-black text-white">{track.name}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-wider text-slate-600">{track.role}</div>
                    <div className="mt-2 flex gap-1">
                      <button type="button" onClick={() => patchTrack(track.id, { muted: !track.muted })} className={`rounded px-2 py-1 text-[9px] ${track.muted ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-slate-400'}`}>M</button>
                      <button type="button" onClick={() => patchTrack(track.id, { solo: !track.solo })} className={`rounded px-2 py-1 text-[9px] ${track.solo ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'}`}>S</button>
                    </div>
                  </div>
                  <div className="relative flex-1">
                    {track.clips.map(clip => {
                      const clipDuration = audioClipDuration(clip);
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => setSelectedClipId(clip.id)}
                          className={`absolute top-3 h-16 overflow-hidden rounded border px-2 text-left ${selectedClipId === clip.id ? 'border-violet-300 bg-violet-500/30' : 'border-violet-400/30 bg-violet-500/15'}`}
                          style={{ left: clip.start * PIXELS_PER_SECOND, width: Math.max(42, clipDuration * PIXELS_PER_SECOND) }}
                        >
                          <span className="block truncate text-[10px] font-bold text-white">{clip.name}</span>
                          <span className="block text-[9px] text-slate-400">{clipDuration.toFixed(2)}s · {Math.round(clip.volume * 100)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="border-l border-white/10 bg-[#070b15] p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Clip Inspector</p>
          {!selectedClip ? (
            <p className="text-xs leading-5 text-slate-500">Select a clip to trim, position, fade, pan, or preview it.</p>
          ) : (
            <div className="space-y-3">
              <div className="truncate text-sm font-black text-white">{selectedClip.name}</div>
              <AudioWaveform src={selectedClip.src} height={64} />
              <audio ref={previewRef} src={selectedClip.src} controls preload="metadata" className="w-full" />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase text-slate-500">Start
                  <input type="number" min={0} step={0.05} value={selectedClip.start} onChange={event => patchClip(selectedClip.id, { start: Math.max(0, Number(event.target.value)) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">Rate
                  <input type="number" min={0.25} max={4} step={0.05} value={selectedClip.playbackRate} onChange={event => patchClip(selectedClip.id, { playbackRate: Math.max(0.25, Math.min(4, Number(event.target.value))) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">In
                  <input type="number" min={0} max={selectedClip.outPoint} step={0.05} value={selectedClip.inPoint} onChange={event => patchClip(selectedClip.id, { inPoint: Math.max(0, Math.min(selectedClip.outPoint - 0.05, Number(event.target.value))) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">Out
                  <input type="number" min={selectedClip.inPoint + 0.05} max={selectedClip.sourceDuration} step={0.05} value={selectedClip.outPoint} onChange={event => patchClip(selectedClip.id, { outPoint: Math.min(selectedClip.sourceDuration, Math.max(selectedClip.inPoint + 0.05, Number(event.target.value))) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
              </div>

              <label className="block text-[10px] uppercase text-slate-500">Volume {Math.round(selectedClip.volume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={event => patchClip(selectedClip.id, { volume: Number(event.target.value) })} className="mt-1 w-full" />
              </label>
              <label className="block text-[10px] uppercase text-slate-500">Pan {selectedClip.pan.toFixed(2)}
                <input type="range" min={-1} max={1} step={0.01} value={selectedClip.pan} onChange={event => patchClip(selectedClip.id, { pan: Number(event.target.value) })} className="mt-1 w-full" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase text-slate-500">Fade In
                  <input type="number" min={0} max={audioClipDuration(selectedClip)} step={0.05} value={selectedClip.fadeIn} onChange={event => patchClip(selectedClip.id, { fadeIn: Math.max(0, Number(event.target.value)) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
                <label className="text-[10px] uppercase text-slate-500">Fade Out
                  <input type="number" min={0} max={audioClipDuration(selectedClip)} step={0.05} value={selectedClip.fadeOut} onChange={event => patchClip(selectedClip.id, { fadeOut: Math.max(0, Number(event.target.value)) })} className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-white" />
                </label>
              </div>

              <Button size="sm" variant="ghost" className="w-full" onClick={() => patchClip(selectedClip.id, { muted: !selectedClip.muted })}>{selectedClip.muted ? 'Unmute Clip' : 'Mute Clip'}</Button>
              <Button size="sm" variant="danger" className="w-full" onClick={deleteSelectedClip}>Delete Clip</Button>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
            <div className="text-xs font-bold text-amber-200">Audio foundation</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Real WAV/MP3 ingest, decoded waveforms, Voice/Music/SFX buses, trim, gain, pan metadata, fades, mute/solo, and autosave are active.
              Offline multi-track WAV mixdown is active with trim, playback rate, track/clip gain, pan, mute/solo, and fades.
              Rendered mixes can now sync directly into Video or Motion as durable Studio Cloud WAV assets without duplicating prior synced clips.
              EQ/compression, recording, and noise cleanup are the next tier.
            </p>
          </div>
        </aside>
      </div>
    </Navigation>
  );
}
