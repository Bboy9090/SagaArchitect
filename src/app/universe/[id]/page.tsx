'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { LocationCard } from '@/components/location/LocationCard';
import { ShareAsArchetypeButton } from '@/components/shared-lore/ShareAsArchetypeButton';
import {
  getUniverseById, getFactions, getCharacters, getLocations,
  getTimeline, getArcs, getLoreRules,
  saveLocations, saveCharacters, saveFactions
} from '@/lib/storage';
import { buildRainstormsSyncPayload, syncToRainstorms, pingRainstorms } from '@/lib/rainstorms';
import type { Universe, Faction, Character, Location } from '@/lib/types';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetProject, dbGetCharacters, dbSaveCharacter, dbGetAssets, dbUploadAsset, dbDeleteAsset, dbRenameAsset, dbGetStudioDocument, dbSaveStudioDocument, type ProjectAsset } from '@/lib/db-client';
import type { PhoenixAssetLibraryDocument, PhoenixAssetLibraryEntry } from '@/lib/studio-document';

interface Section {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

interface CanonPageProps {
  params: Promise<{ id: string }>;
}

const RAINSTORMS_URL_KEY = 'loreengine_rainstorms_url';

function createAssetLibraryDocument(projectId: string): PhoenixAssetLibraryDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: 'Project Asset Library',
    folders: [],
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function CanonCorePage({ params }: CanonPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [charactersList, setCharactersList] = useState<Character[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ chars: 0, factions: 0, locations: 0, events: 0, arcs: 0, lore: 0 });
  const [locations, setLocations] = useState<Location[]>([]);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [assetsList, setAssetsList] = useState<ProjectAsset[]>([]);
  const [assetQuery, setAssetQuery] = useState('');
  const [assetType, setAssetType] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [assetSort, setAssetSort] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');
  const [assetUploadStatus, setAssetUploadStatus] = useState('');
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renameAssetValue, setRenameAssetValue] = useState('');
  const [assetLibraryDocument, setAssetLibraryDocument] = useState<PhoenixAssetLibraryDocument | null>(null);
  const [assetFolderFilter, setAssetFolderFilter] = useState('all');
  const [assetFavoritesOnly, setAssetFavoritesOnly] = useState(false);
  const [newAssetFolderName, setNewAssetFolderName] = useState('');
  const [assetTagDrafts, setAssetTagDrafts] = useState<Record<string, string>>({});

  const assetMetadataById = useMemo(
    () => new Map((assetLibraryDocument?.entries || []).map(entry => [entry.assetId, entry])),
    [assetLibraryDocument?.entries],
  );

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    const matches = assetsList.filter(asset => {
      const meta = assetMetadataById.get(asset.id);
      const typeMatches = assetType === 'all'
        || (assetType === 'image' && asset.mime_type.startsWith('image/'))
        || (assetType === 'video' && asset.mime_type.startsWith('video/'))
        || (assetType === 'audio' && asset.mime_type.startsWith('audio/'));
      const folderMatches = assetFolderFilter === 'all'
        || (assetFolderFilter === 'unfiled' && !meta?.folderId)
        || meta?.folderId === assetFolderFilter;
      const favoriteMatches = !assetFavoritesOnly || meta?.favorite === true;
      const queryMatches = !query
        || asset.name.toLowerCase().includes(query)
        || asset.mime_type.toLowerCase().includes(query)
        || (meta?.tags || []).some(tag => tag.toLowerCase().includes(query));
      return typeMatches && folderMatches && favoriteMatches && queryMatches;
    });
    return [...matches].sort((a, b) => {
      if (assetSort === 'name') return a.name.localeCompare(b.name);
      if (assetSort === 'size') return b.file_size - a.file_size;
      const aTime = Date.parse(a.created_at || '') || 0;
      const bTime = Date.parse(b.created_at || '') || 0;
      return assetSort === 'oldest' ? aTime - bTime : bTime - aTime;
    });
  }, [assetsList, assetMetadataById, assetQuery, assetType, assetSort, assetFolderFilter, assetFavoritesOnly]);

  useEffect(() => {
    if (!assetLibraryDocument || !isDbMode()) return;
    const handle = window.setTimeout(() => {
      void dbSaveStudioDocument(id, 'asset_library', assetLibraryDocument)
        .catch(error => console.error('Phoenix Asset Library cloud autosave failed:', error));
    }, 600);
    return () => window.clearTimeout(handle);
  }, [assetLibraryDocument, id]);

  const updateAssetLibraryDocument = (updater: (current: PhoenixAssetLibraryDocument) => PhoenixAssetLibraryDocument) => {
    setAssetLibraryDocument(current => {
      if (!current) return current;
      return { ...updater(current), updatedAt: new Date().toISOString() };
    });
  };

  const patchAssetMetadata = (assetId: string, patch: Partial<PhoenixAssetLibraryEntry>) => {
    updateAssetLibraryDocument(current => {
      const existing = current.entries.find(entry => entry.assetId === assetId) || { assetId, tags: [] };
      const next = { ...existing, ...patch, assetId, tags: patch.tags || existing.tags || [] };
      return {
        ...current,
        entries: [...current.entries.filter(entry => entry.assetId !== assetId), next],
      };
    });
  };

  const addAssetFolder = () => {
    const name = newAssetFolderName.trim();
    if (!name) return;
    updateAssetLibraryDocument(current => {
      if (current.folders.some(folder => folder.name.toLowerCase() === name.toLowerCase())) return current;
      return {
        ...current,
        folders: [...current.folders, { id: crypto.randomUUID(), name: name.slice(0, 120) }].slice(0, 100),
      };
    });
    setNewAssetFolderName('');
  };

  const removeAssetFolder = (folderId: string) => {
    updateAssetLibraryDocument(current => ({
      ...current,
      folders: current.folders.filter(folder => folder.id !== folderId),
      entries: current.entries.map(entry => entry.folderId === folderId ? { ...entry, folderId: undefined } : entry),
    }));
    if (assetFolderFilter === folderId) setAssetFolderFilter('all');
  };

  const addAssetTag = (assetId: string) => {
    const raw = (assetTagDrafts[assetId] || '').trim();
    if (!raw) return;
    const tag = raw.slice(0, 40);
    const existing = assetMetadataById.get(assetId);
    const tags = [...new Set([...(existing?.tags || []), tag])].slice(0, 20);
    patchAssetMetadata(assetId, { tags });
    setAssetTagDrafts(current => ({ ...current, [assetId]: '' }));
  };

  const removeAssetTag = (assetId: string, tag: string) => {
    const existing = assetMetadataById.get(assetId);
    patchAssetMetadata(assetId, { tags: (existing?.tags || []).filter(entry => entry !== tag) });
  };

  // Rainstorms sync state
  const [showRainstormsModal, setShowRainstormsModal] = useState(false);
  const [rainstormsUrl, setRainstormsUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pinging' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [pingOk, setPingOk] = useState<boolean | null>(null);

  const fetchProjectData = useCallback(async () => {
    try {
      const isDb = isDbMode();
      let u: Universe | null = null;
      let chars: Character[] = [];
      if (isDb) {
        u = await dbGetProject(id);
        chars = await dbGetCharacters(id);
        const dbAssets = await dbGetAssets(id);
        setAssetsList(dbAssets);
        const cloudAssetLibrary = await dbGetStudioDocument<PhoenixAssetLibraryDocument>(id, 'asset_library');
        setAssetLibraryDocument(cloudAssetLibrary || createAssetLibraryDocument(id));
      } else {
        u = getUniverseById(id) || null;
        chars = getCharacters(id);
      }

      if (!u) {
        router.push('/dashboard');
        return;
      }

      setUniverse(u);
      setCharactersList(chars);
      const locs = getLocations(id);
      setLocations(locs);
      setStats({
        chars: chars.length,
        factions: getFactions(id).length,
        locations: locs.length,
        events: getTimeline(id).length,
        arcs: getArcs(id).length,
        lore: getLoreRules(id).length,
      });
    } catch (err) {
      console.error(err);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjectData();
      const saved = localStorage.getItem(RAINSTORMS_URL_KEY);
      if (saved) setRainstormsUrl(saved);
    }, 0);
    return () => clearTimeout(timer);
  }, [id, router, fetchProjectData]);

  const toggleSection = (sectionId: string) => {
    setExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  /** Build a full canon block payload — used for all AI generation calls */
  const buildCanonPayload = () => {
    if (!universe) return {};
    return {
      universe,
      factions: getFactions(id),
      characters: charactersList,
      locations: getLocations(id),
      timeline: getTimeline(id),
      lore_rules: getLoreRules(id),
      story_arcs: getArcs(id),
    };
  };

  /**
   * Export the universe as a raw LoreEngine payload — for Rainstorms or external tools.
   *
   * We export the raw CanonBlockInput (universe + entity arrays), NOT the processed
   * CanonBlock. This is the format Rainstorms POSTs to /api/lore-engine/canon-block
   * or /api/universes/{id}/story-context to receive a story context.
   *
   * Shape:
   *   { universe, factions[], characters[], locations[], timeline[], lore_rules[], story_arcs[] }
   *
   * Rainstorms then does:
   *   POST https://sagaarchitect.app/api/lore-engine/canon-block
   *   Content-Type: application/json
   *   Body: <exported JSON>
   *   → receives { canonBlock, promptContext, stats }
   */
  const handleExportCanon = async () => {
    if (!universe) return;
    const payload = buildCanonPayload();
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Sanitize filename: replace whitespace and any character not safe in filenames
      const safeName = universe.name.replace(/[^\w\-. ]/g, '').replace(/\s+/g, '_');
      a.download = `${safeName}_lore_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /** Open the Rainstorms sync modal, resetting previous sync state */
  const handleOpenRainstormsModal = () => {
    setSyncStatus('idle');
    setSyncMessage('');
    setPingOk(null);
    setShowRainstormsModal(true);
  };
  const handlePing = async () => {
    if (!rainstormsUrl.trim()) return;
    setSyncStatus('pinging');
    setPingOk(null);
    const result = await pingRainstorms(rainstormsUrl.trim());
    setPingOk(result.reachable);
    setSyncMessage(result.detail);
    setSyncStatus('idle');
  };

  /** Push this universe to the Rainstorms backend */
  const handleSyncToRainstorms = async () => {
    if (!universe || !rainstormsUrl.trim()) return;
    // Save URL for next time
    localStorage.setItem(RAINSTORMS_URL_KEY, rainstormsUrl.trim());
    setSyncStatus('syncing');
    setSyncMessage('');
    const payload = buildRainstormsSyncPayload(
      universe,
      getFactions(id),
      charactersList,
      getLocations(id),
      getTimeline(id),
      getArcs(id),
      getLoreRules(id),
    );
    const result = await syncToRainstorms(rainstormsUrl.trim(), payload);
    setSyncStatus(result.success ? 'success' : 'error');
    setSyncMessage(result.message + (result.detail ? `\n\nDetail: ${result.detail}` : ''));
  };

  const generateLocations = async () => {
    if (!universe) return;
    setGenLoading('locations');
    try {
      const res = await fetch('/api/generate/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send full canon context so locations tie into existing lore
        body: JSON.stringify(buildCanonPayload()),
      });
      const data = await res.json();
      if (data.locations) {
        const newLocs: Location[] = data.locations.map((l: Omit<Location, 'id' | 'universe_id'>) => ({
          ...l,
          id: crypto.randomUUID(),
          universe_id: id,
        }));
        saveLocations(id, newLocs);
        setLocations(newLocs);
        setStats(prev => ({ ...prev, locations: newLocs.length }));
      }
    } finally {
      setGenLoading(null);
    }
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Opening archive..." />
      </div>
    </Navigation>
  );

  if (!universe) return null;

  const sections: Section[] = [
    {
      id: 'overview',
      icon: '🌍',
      title: 'World Overview',
      content: <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{universe.world_overview || 'No overview generated yet.'}</p>,
    },
    {
      id: 'myth',
      icon: '📜',
      title: 'Creation Myth',
      content: <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{universe.creation_myth || 'No creation myth yet.'}</p>,
    },
    {
      id: 'themes',
      icon: '🎭',
      title: 'Core Themes',
      content: (
        <div className="flex flex-wrap gap-2">
          {universe.themes?.length > 0
            ? universe.themes.map((t, i) => (
              <span key={i} className="text-sm bg-purple-900/20 border border-purple-500/20 rounded px-3 py-1 text-purple-300">{t}</span>
            ))
            : <p className="text-gray-500 text-sm">No themes defined.</p>
          }
        </div>
      ),
    },
    {
      id: 'conflict',
      icon: '⚡',
      title: 'Current Conflict',
      content: <p className="text-gray-300 text-sm leading-relaxed">{universe.current_conflict || 'No conflict defined.'}</p>,
    },
    {
      id: 'prophecy',
      icon: '🔮',
      title: 'Prophecy Hooks',
      content: (
        <ul className="space-y-2">
          {universe.prophecy_hooks?.length > 0
            ? universe.prophecy_hooks.map((p, i) => (
              <li key={i} className="text-gray-300 text-sm flex gap-2">
                <span className="text-[#c9a84c]/50 mt-0.5">◆</span>
                {p}
              </li>
            ))
            : <p className="text-gray-500 text-sm">No prophecy hooks defined.</p>
          }
        </ul>
      ),
    },
    {
      id: 'factions',
      icon: '🏛️',
      title: `Factions (${stats.factions})`,
      content: (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/factions`)}>
            View All Factions
          </Button>
          <Button
            variant="ghost" size="sm"
            loading={genLoading === 'factions'}
            onClick={async () => {
              setGenLoading('factions');
              try {
                const res = await fetch('/api/generate/factions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  // Send full canon context for consistent faction generation
                  body: JSON.stringify(buildCanonPayload()),
                });
                const data = await res.json();
                if (data.factions) {
                  saveFactions(id, data.factions.map((f: Omit<Faction, 'id' | 'universe_id'>) => ({
                    ...f, id: crypto.randomUUID(), universe_id: id,
                  })));
                  setStats(prev => ({ ...prev, factions: data.factions.length }));
                }
              } finally { setGenLoading(null); }
            }}
          >
            ✨ Generate
          </Button>
        </div>
      ),
    },
    {
      id: 'characters',
      icon: '👤',
      title: `Characters (${stats.chars})`,
      content: (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/characters`)}>
            View All Characters
          </Button>
          <Button
            variant="ghost" size="sm"
            loading={genLoading === 'characters'}
            onClick={async () => {
              setGenLoading('characters');
              try {
                const res = await fetch('/api/generate/characters', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  // Send full canon context for consistent character generation
                  body: JSON.stringify(buildCanonPayload()),
                });
                const data = await res.json();
                if (data.characters) {
                  const newChars = data.characters.map((c: Omit<Character, 'id' | 'universe_id'>) => ({
                    ...c, id: crypto.randomUUID(), universe_id: id,
                  }));
                  if (isDbMode()) {
                    for (const char of newChars) {
                      await dbSaveCharacter(id, char);
                    }
                  } else {
                    saveCharacters(id, newChars);
                  }
                  await fetchProjectData();
                }
              } finally { setGenLoading(null); }
            }}
          >
            ✨ Generate
          </Button>
        </div>
      ),
    },
    {
      id: 'locations',
      icon: '📍',
      title: `Locations (${stats.locations})`,
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" loading={genLoading === 'locations'} onClick={generateLocations}>
              ✨ Generate Locations
            </Button>
          </div>
          {locations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {locations.map(loc => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  universeMeta={{ genre: universe.genre, tone: universe.tone, era: universe.era }}
                  onDelete={locId => {
                    setLocations(prev => prev.filter(l => l.id !== locId));
                    setStats(prev => ({ ...prev, locations: prev.locations - 1 }));
                    saveLocations(id, locations.filter(l => l.id !== locId));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'timeline',
      icon: '⏳',
      title: `Timeline (${stats.events} events)`,
      content: (
        <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/timeline`)}>
          View Full Timeline
        </Button>
      ),
    },
    {
      id: 'lore',
      icon: '⚡',
      title: `Lore Rules (${stats.lore})`,
      content: (
        <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/lore`)}>
          Open Lore Memory
        </Button>
      ),
    },
    {
      id: 'assets',
      icon: '📍',
      title: `Asset Library (${isDbMode() ? assetsList.length : 'DB only'})`,
      content: (
        <div className="space-y-4">
          {!isDbMode() ? (
            <div className="bg-[#121217] border border-[#c9a84c]/20 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">
                🗄️ The Asset Library is available in **PostgreSQL Database Mode**. Switch to DB Mode on the dashboard to upload and serve production media.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#121217] border border-[#c9a84c]/10 rounded-lg p-4">
                <input
                  type="file"
                  id="asset-upload-input"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/wav,audio/mpeg"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []).slice(0, 20);
                    e.currentTarget.value = '';
                    if (files.length === 0) return;
                    const failures: string[] = [];
                    try {
                      setGenLoading('asset-upload');
                      setAssetUploadStatus(`Uploading 0/${files.length}…`);
                      for (let index = 0; index < files.length; index += 1) {
                        const file = files[index];
                        try {
                          await dbUploadAsset(id, file);
                        } catch (err) {
                          failures.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`);
                        }
                        setAssetUploadStatus(`Uploading ${index + 1}/${files.length}…`);
                      }
                      const dbAssets = await dbGetAssets(id);
                      setAssetsList(dbAssets);
                      setAssetUploadStatus(
                        failures.length === 0
                          ? `Uploaded ${files.length} asset${files.length === 1 ? '' : 's'}.`
                          : `Uploaded ${files.length - failures.length}/${files.length}; ${failures.length} failed.`,
                      );
                      if (failures.length > 0) alert(failures.join('\n'));
                    } finally {
                      setGenLoading(null);
                    }
                  }}
                />
                <Button
                  variant="gold"
                  size="sm"
                  loading={genLoading === 'asset-upload'}
                  onClick={() => document.getElementById('asset-upload-input')?.click()}
                >
                  📤 Upload Media
                </Button>
                <span className="text-xs text-gray-500">Up to 20 files per batch. Images: 5MB max. MP4/WebM/WAV/MP3: 64MB max.</span>
                {assetUploadStatus && <span className="text-xs text-emerald-300/80">{assetUploadStatus}</span>}
              </div>

              <div className="rounded-lg border border-violet-400/10 bg-violet-400/[0.03] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300/70">Folders</span>
                  <input
                    value={newAssetFolderName}
                    maxLength={120}
                    onChange={event => setNewAssetFolderName(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') addAssetFolder(); }}
                    placeholder="New folder name"
                    className="min-h-9 min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-2 text-xs text-white"
                  />
                  <Button size="sm" variant="ghost" disabled={!newAssetFolderName.trim()} onClick={addAssetFolder}>Add folder</Button>
                </div>
                {(assetLibraryDocument?.folders || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(assetLibraryDocument?.folders || []).map(folder => (
                      <div key={folder.id} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                        <button type="button" onClick={() => setAssetFolderFilter(folder.id)} className="text-[10px] text-slate-300 hover:text-white">{folder.name}</button>
                        <button type="button" onClick={() => removeAssetFolder(folder.id)} className="text-[10px] text-slate-600 hover:text-rose-300" aria-label={`Delete folder ${folder.name}`}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {assetsList.length > 0 && (
                <div className="grid grid-cols-1 gap-2 rounded-lg border border-white/5 bg-black/10 p-3 md:grid-cols-[minmax(0,1fr)_140px_160px_150px]">
                  <input
                    value={assetQuery}
                    onChange={event => setAssetQuery(event.target.value)}
                    placeholder="Search assets by name or type…"
                    className="min-h-10 rounded border border-white/10 bg-[#0a0d14] px-3 text-sm text-white placeholder:text-gray-600"
                    aria-label="Search project assets"
                  />
                  <select
                    value={assetType}
                    onChange={event => setAssetType(event.target.value as 'all' | 'image' | 'video' | 'audio')}
                    className="min-h-10 rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white"
                    aria-label="Filter assets by media type"
                  >
                    <option value="all">All media</option>
                    <option value="image">Images</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                  <select
                    value={assetFolderFilter}
                    onChange={event => setAssetFolderFilter(event.target.value)}
                    className="min-h-10 rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white"
                    aria-label="Filter assets by folder"
                  >
                    <option value="all">All folders</option>
                    <option value="unfiled">Unfiled</option>
                    {(assetLibraryDocument?.folders || []).map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                  <select
                    value={assetSort}
                    onChange={event => setAssetSort(event.target.value as 'newest' | 'oldest' | 'name' | 'size')}
                    className="min-h-10 rounded border border-white/10 bg-[#0a0d14] px-2 text-xs text-white"
                    aria-label="Sort project assets"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name A–Z</option>
                    <option value="size">Largest first</option>
                  </select>
                  <label className="flex min-h-10 items-center gap-2 rounded border border-white/10 bg-[#0a0d14] px-3 text-xs text-white md:col-span-4">
                    <input type="checkbox" checked={assetFavoritesOnly} onChange={event => setAssetFavoritesOnly(event.target.checked)} />
                    Favorites only
                  </label>
                </div>
              )}

              {assetsList.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No assets uploaded to this project yet.</p>
              ) : filteredAssets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 py-8 text-center">
                  <p className="text-sm text-gray-500">No assets match this search/filter.</p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-[#c9a84c] hover:text-[#e1c76f]"
                    onClick={() => { setAssetQuery(''); setAssetType('all'); }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600">
                    Showing {filteredAssets.length} of {assetsList.length} assets
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {filteredAssets.map((asset) => (
                    <div key={asset.id} className="relative group bg-[#121217] border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 rounded-lg p-2 flex flex-col justify-between overflow-hidden">
                      <div className="aspect-video w-full relative bg-black/40 rounded overflow-hidden mb-2 flex items-center justify-center">
                        {asset.mime_type.startsWith('image/') ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={asset.serve_url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          </>
                        ) : asset.mime_type.startsWith('video/') ? (
                          <video
                            src={asset.serve_url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-violet-300">
                            <span className="text-3xl">♫</span>
                            <span className="text-[9px] uppercase tracking-wider">{asset.mime_type}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        {renamingAssetId === asset.id ? (
                          <div className="space-y-1">
                            <input
                              value={renameAssetValue}
                              maxLength={255}
                              autoFocus
                              onChange={event => setRenameAssetValue(event.target.value)}
                              onKeyDown={async event => {
                                if (event.key === 'Escape') {
                                  setRenamingAssetId(null);
                                  setRenameAssetValue('');
                                  return;
                                }
                                if (event.key !== 'Enter') return;
                                const name = renameAssetValue.trim();
                                if (!name) return;
                                try {
                                  const updated = await dbRenameAsset(asset.id, name);
                                  setAssetsList(current => current.map(item => item.id === asset.id ? updated : item));
                                  setRenamingAssetId(null);
                                  setRenameAssetValue('');
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : 'Failed to rename asset');
                                }
                              }}
                              className="min-h-8 w-full rounded border border-[#c9a84c]/30 bg-black/30 px-2 text-xs text-white"
                              aria-label={`Rename ${asset.name}`}
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="text-[9px] text-emerald-300 hover:text-emerald-200"
                                onClick={async () => {
                                  const name = renameAssetValue.trim();
                                  if (!name) return;
                                  try {
                                    const updated = await dbRenameAsset(asset.id, name);
                                    setAssetsList(current => current.map(item => item.id === asset.id ? updated : item));
                                    setRenamingAssetId(null);
                                    setRenameAssetValue('');
                                  } catch (err) {
                                    alert(err instanceof Error ? err.message : 'Failed to rename asset');
                                  }
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="text-[9px] text-gray-500 hover:text-gray-300"
                                onClick={() => { setRenamingAssetId(null); setRenameAssetValue(''); }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => { setRenamingAssetId(asset.id); setRenameAssetValue(asset.name); }}
                              className="truncate text-left text-xs font-bold text-white hover:text-[#e1c76f]"
                              title={`Rename ${asset.name}`}
                            >
                              {asset.name}
                            </button>
                            <span className="text-[10px] text-gray-500">{(asset.file_size / 1024).toFixed(0)} KB</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className={`text-sm ${assetMetadataById.get(asset.id)?.favorite ? 'text-amber-300' : 'text-gray-600 hover:text-amber-300'}`}
                            onClick={() => patchAssetMetadata(asset.id, { favorite: !assetMetadataById.get(asset.id)?.favorite })}
                            aria-label={assetMetadataById.get(asset.id)?.favorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            ★
                          </button>
                          <select
                            value={assetMetadataById.get(asset.id)?.folderId || ''}
                            onChange={event => patchAssetMetadata(asset.id, { folderId: event.target.value || undefined })}
                            className="min-h-7 min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-1 text-[9px] text-gray-400"
                            aria-label={`Folder for ${asset.name}`}
                          >
                            <option value="">Unfiled</option>
                            {(assetLibraryDocument?.folders || []).map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(assetMetadataById.get(asset.id)?.tags || []).map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => removeAssetTag(asset.id, tag)}
                              className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.04] px-1.5 py-0.5 text-[8px] text-cyan-200/70 hover:border-rose-400/30 hover:text-rose-200"
                              title="Remove tag"
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                        <input
                          value={assetTagDrafts[asset.id] || ''}
                          maxLength={40}
                          onChange={event => setAssetTagDrafts(current => ({ ...current, [asset.id]: event.target.value }))}
                          onKeyDown={event => { if (event.key === 'Enter') addAssetTag(asset.id); }}
                          placeholder="Add tag + Enter"
                          className="min-h-7 w-full rounded border border-white/10 bg-black/20 px-1.5 text-[9px] text-gray-300 placeholder:text-gray-700"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete asset "${asset.name}"?`)) return;
                          try {
                            await dbDeleteAsset(asset.id);
                            const dbAssets = await dbGetAssets(id);
                            setAssetsList(dbAssets);
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : 'Failed to delete asset';
                            alert(msg);
                          }
                        }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-[#c41e3a] text-white p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Asset"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  const inputClass = 'w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-600';

  return (
    <Navigation>
      <Header
        title={universe.name}
        subtitle={`${universe.genre} · ${universe.tone} · ${universe.era}`}
        actions={
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="gold" size="sm" onClick={() => router.push(`/universe/${id}/studio`)}>
              ✦ Open Studio Hub
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/director`)}>
              ◆ AI Director
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/stories`)}>
              📖 Writing Room
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={handleExportCanon}
            >
              {exportCopied ? '✓ Copied!' : '⚡ Export Canon'}
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={handleOpenRainstormsModal}
            >
              🌧 Sync to Rainstorms
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/arcs`)}>
              ⚔️ Arc Forge
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/lore`)}>
              🔮 Lore Memory
            </Button>
            {isDbMode() && (
              <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/history`)}>
                ⏳ Version History
              </Button>
            )}
            {isDbMode() && (
              <Button variant="secondary" size="sm" onClick={() => router.push(`/universe/${id}/canon`)}>
                🛡️ Canon Integrity
              </Button>
            )}
            <ShareAsArchetypeButton
              target={{ kind: 'universe', entity: universe }}
            />
          </div>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Meta info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Tech Level', value: universe.tech_level },
            { label: 'Magic System', value: universe.magic_system || 'None' },
            { label: 'Genre', value: universe.genre },
            { label: 'Tone', value: universe.tone },
          ].map(item => (
            <div key={item.label} className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-3">
              <p className="text-[10px] text-[#c9a84c]/50 uppercase tracking-widest">{item.label}</p>
              <p className="text-white text-sm font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8">
          {[
            { label: 'Characters', value: stats.chars, href: 'characters' },
            { label: 'Factions', value: stats.factions, href: 'factions' },
            { label: 'Locations', value: stats.locations, href: '' },
            { label: 'Events', value: stats.events, href: 'timeline' },
            { label: 'Arcs', value: stats.arcs, href: 'arcs' },
            { label: 'Lore Rules', value: stats.lore, href: 'lore' },
          ].map(stat => (
            <button
              key={stat.label}
              onClick={() => stat.href && router.push(`/universe/${id}/${stat.href}`)}
              className={`bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg p-3 text-center ${stat.href ? 'hover:border-[#c9a84c]/40 transition-colors cursor-pointer' : ''}`}
            >
              <div className="text-2xl font-bold text-[#c9a84c]">{stat.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest">{stat.label}</div>
            </button>
          ))}
        </div>

        {/* Expandable sections */}
        <div className="space-y-2">
          {sections.map(section => (
            <div key={section.id} className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#c9a84c]/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span>{section.icon}</span>
                  <span className="font-semibold text-white text-sm">{section.title}</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {expanded[section.id] ? '▲' : '▼'}
                </span>
              </button>
              {expanded[section.id] && (
                <div className="px-4 pb-4 pt-1 border-t border-[#c9a84c]/10">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sync to Rainstorms modal */}
      <Modal open={showRainstormsModal} onClose={() => setShowRainstormsModal(false)} title="Sync to Rainstorms" size="lg">
        <div className="space-y-4">
          {/* Explanation */}
          <div className="bg-[#0a0a0f] border border-[#c9a84c]/20 rounded-lg p-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              Push <span className="text-[#c9a84c] font-semibold">{universe.name}</span> — including all factions, characters, locations, timeline events, arcs, and lore rules — into the Rainstorms backend so it can generate canon-consistent stories from this universe.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Field mappings applied automatically: <code className="text-gray-500">tech_level → technology_level</code>, <code className="text-gray-500">themes[] → core_theme</code>
            </p>
          </div>

          {/* URL input */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Rainstorms Base URL
            </label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={rainstormsUrl}
                onChange={e => { setRainstormsUrl(e.target.value); setPingOk(null); setSyncMessage(''); }}
                placeholder="http://localhost:8001"
              />
              <Button
                variant="ghost"
                size="sm"
                loading={syncStatus === 'pinging'}
                onClick={handlePing}
                disabled={!rainstormsUrl.trim()}
              >
                Test
              </Button>
            </div>
            {pingOk === true && (
              <p className="text-xs text-green-400 mt-1">✓ Rainstorms is reachable</p>
            )}
            {pingOk === false && (
              <p className="text-xs text-red-400 mt-1">✗ Cannot reach Rainstorms — check URL and CORS</p>
            )}
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Factions', value: stats.factions },
              { label: 'Characters', value: stats.chars },
              { label: 'Locations', value: stats.locations },
              { label: 'Events', value: stats.events },
              { label: 'Arcs', value: stats.arcs },
              { label: 'Lore Rules', value: stats.lore },
            ].map(s => (
              <div key={s.label} className="bg-[#0f0f1a] border border-[#c9a84c]/10 rounded p-2">
                <div className="text-lg font-bold text-[#c9a84c]">{s.value}</div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Result message */}
          {syncMessage && (
            <div className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap ${
              syncStatus === 'success' ? 'bg-green-900/20 border border-green-500/20 text-green-300' : 'bg-red-900/20 border border-red-500/20 text-red-300'
            }`}>
              {syncMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="gold"
              loading={syncStatus === 'syncing'}
              disabled={!rainstormsUrl.trim() || syncStatus === 'pinging'}
              onClick={handleSyncToRainstorms}
            >
              {syncStatus === 'success' ? '✓ Synced!' : '🌧 Sync Universe to Rainstorms'}
            </Button>
            <Button variant="ghost" onClick={() => setShowRainstormsModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Navigation>
  );
}

