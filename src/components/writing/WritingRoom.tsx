'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteWritingDocument, getWritingDocuments, saveUniverse, saveWritingDocument } from '@/lib/storage';
import { compileWritingProject, countWords, createWritingBackup, documentExport, importWritingBackup, moveWritingDocument, orderedWritingDocuments, reparentWritingScene, safeExportName } from '@/lib/writing-documents';
import { createDocxPackage, createEpubPackage } from '@/lib/publishing-packages';
import { analyzePublishingReadiness } from '@/lib/publishing-preflight';
import { isDbMode } from '@/lib/storage-mode';
import { dbDeleteWritingDocument, dbGetWritingDocumentRevisions, dbGetWritingDocuments, dbReorderWritingDocuments, dbRestoreWritingDocument, dbSaveWritingDocument, dbUpdateProject } from '@/lib/db-client';
import { EMPTY_PUBLISHING_METADATA, normalizePublishingMetadata } from '@/lib/publishing-metadata';
import { documentsForExportProfile, EXPORT_PROFILES, getExportProfile } from '@/lib/export-profiles';
import { replaceInWritingDocuments, searchWritingDocuments } from '@/lib/project-search';
import { instantiateWritingTemplate, WRITING_TEMPLATES } from '@/lib/writing-templates';
import type { PublishingMetadata, Universe, WritingDocument, WritingDocumentKind, WritingDocumentRevision, WritingDocumentStatus } from '@/lib/types';

const KIND_LABELS: Record<WritingDocumentKind, string> = {
  title_page: 'Title Page', copyright: 'Copyright', dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword', preface: 'Preface',
  manuscript: 'Manuscript', chapter: 'Chapter', scene: 'Scene', screenplay: 'Screenplay', comic_script: 'Comic Script',
  acknowledgements: 'Acknowledgements', about_author: 'About the Author', appendix: 'Appendix', notes: 'Notes',
};
const STATUS_LABELS: Record<WritingDocumentStatus, string> = {
  outline: 'Outline', draft: 'Draft', revision: 'Revision', final: 'Final',
};

interface WritingRoomProps { universe: Universe }

export function WritingRoom({ universe }: WritingRoomProps) {
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'conflict'>('saved');
  const [revisions, setRevisions] = useState<WritingDocumentRevision[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [metadata, setMetadata] = useState<PublishingMetadata>(() => ({ ...EMPTY_PUBLISHING_METADATA, ...normalizePublishingMetadata(universe.publishing_metadata) }));
  const [metadataState, setMetadataState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [exportProfileId, setExportProfileId] = useState('editor_submission');
  const [searchQuery, setSearchQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [selectedSearchIds, setSelectedSearchIds] = useState<Set<string>>(new Set());
  const loaded = useRef(false);
  const suppressSavedVersion = useRef<{ id: string; version?: number } | undefined>(undefined);
  const importInput = useRef<HTMLInputElement | null>(null);
  const active = documents.find(item => item.id === activeId);

  useEffect(() => {
    const initialize = async () => {
      const localDocuments = getWritingDocuments(universe.id);
      let existing = localDocuments;
      if (isDbMode()) {
        try {
          const cloudDocuments = await dbGetWritingDocuments(universe.id);
          if (cloudDocuments.length) {
            existing = cloudDocuments;
            cloudDocuments.forEach(saveWritingDocument);
          } else if (localDocuments.length) {
            existing = [];
            for (const document of localDocuments) existing.push(await dbSaveWritingDocument(universe.id, document));
          }
        } catch {
          setSaveState('offline');
        }
      }
      if (existing.length) {
        setDocuments(existing);
        setActiveId(existing[0].id);
      } else {
        const now = new Date().toISOString();
        let first = saveWritingDocument({
          id: crypto.randomUUID(), project_id: universe.id, title: universe.name,
          kind: 'manuscript', status: 'outline', content: '', order: 0,
          word_target: universe.production_type === 'film' ? 15000 : 80000,
          created_at: now, updated_at: now,
        });
        if (isDbMode()) {
          try { first = await dbSaveWritingDocument(universe.id, first); }
          catch { setSaveState('offline'); }
        }
        setDocuments([first]);
        setActiveId(first.id);
      }
      loaded.current = true;
    };
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  }, [universe.id, universe.name, universe.production_type]);

  useEffect(() => {
    if (!loaded.current || !active) return;
    if (suppressSavedVersion.current?.id === active.id && suppressSavedVersion.current.version === active.version) {
      suppressSavedVersion.current = undefined;
      return;
    }
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      const local = saveWritingDocument(active);
      if (isDbMode()) {
        void dbSaveWritingDocument(universe.id, local)
          .then(saved => {
            suppressSavedVersion.current = { id: saved.id, version: saved.version };
            saveWritingDocument(saved);
            setDocuments(current => current.map(item => item.id === saved.id ? saved : item));
            setSaveState('saved');
          })
          .catch(error => setSaveState(error instanceof Error && /changed on another device/i.test(error.message) ? 'conflict' : 'offline'));
      } else {
        setSaveState('saved');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [active, universe.id]);

  const totalWords = useMemo(() => documents.reduce((sum, item) => sum + countWords(item.content), 0), [documents]);
  const activeWords = active ? countWords(active.content) : 0;
  const progress = active?.word_target ? Math.min(100, Math.round(activeWords / active.word_target * 100)) : 0;
  const publishingReadiness = useMemo(() => analyzePublishingReadiness(universe.name, documents, metadata), [documents, metadata, universe.name]);
  const searchResults = useMemo(() => searchWritingDocuments(documents, searchQuery, { case_sensitive: caseSensitive, whole_word: wholeWord }), [caseSensitive, documents, searchQuery, wholeWord]);
  const selectedMatches = searchResults.filter(result => selectedSearchIds.has(result.document_id)).reduce((sum, result) => sum + result.matches, 0);

  const selectSearchResults = (query: string, nextCaseSensitive = caseSensitive, nextWholeWord = wholeWord) => {
    setSelectedSearchIds(new Set(searchWritingDocuments(documents, query, { case_sensitive: nextCaseSensitive, whole_word: nextWholeWord }).map(result => result.document_id)));
  };

  const updateMetadata = (field: keyof PublishingMetadata, value: string) => {
    setMetadata(current => ({ ...current, [field]: value }));
    setMetadataState('saved');
  };

  const persistMetadata = async () => {
    setMetadataState('saving');
    const normalized = normalizePublishingMetadata(metadata);
    try {
      const nextUniverse = { ...universe, publishing_metadata: normalized, updated_at: new Date().toISOString() };
      saveUniverse(nextUniverse);
      if (isDbMode()) {
        const saved = await dbUpdateProject(universe.id, { publishing_metadata: normalized });
        saveUniverse(saved);
        setMetadata({ ...EMPTY_PUBLISHING_METADATA, ...normalizePublishingMetadata(saved.publishing_metadata) });
      } else setMetadata({ ...EMPTY_PUBLISHING_METADATA, ...normalized });
      setMetadataState('saved');
    } catch {
      setMetadataState('error');
    }
  };

  const replaceSelectedMatches = async () => {
    if (!selectedMatches || !confirm(`Replace ${selectedMatches} match${selectedMatches === 1 ? '' : 'es'} across ${selectedSearchIds.size} selected document${selectedSearchIds.size === 1 ? '' : 's'}?`)) return;
    const result = replaceInWritingDocuments(documents, searchQuery, replacement, selectedSearchIds, { case_sensitive: caseSensitive, whole_word: wholeWord });
    setSaveState('saving');
    try {
      const saved: WritingDocument[] = [];
      for (const document of result.documents) {
        const previous = documents.find(item => item.id === document.id);
        if (previous?.content === document.content) { saved.push(document); continue; }
        let next = saveWritingDocument(document);
        if (isDbMode()) next = await dbSaveWritingDocument(universe.id, next);
        saveWritingDocument(next); saved.push(next);
      }
      setDocuments(saved);
      setSaveState('saved');
    } catch (error) {
      setSaveState(error instanceof Error && /changed on another device/i.test(error.message) ? 'conflict' : 'offline');
    }
  };

  const updateActive = (patch: Partial<WritingDocument>) => {
    if (!activeId) return;
    setDocuments(current => current.map(item => item.id === activeId ? { ...item, ...patch } : item));
  };

  const persistOutline = async (nextDocuments: WritingDocument[]) => {
    setSaveState('saving');
    try {
      const changed = nextDocuments.some(document => {
        const previous = documents.find(item => item.id === document.id);
        return !previous || previous.order !== document.order || previous.parent_id !== document.parent_id;
      });
      if (!changed) { setSaveState('saved'); return; }
      const saved = isDbMode() ? await dbReorderWritingDocuments(universe.id, nextDocuments) : nextDocuments.map(saveWritingDocument);
      saved.forEach(saveWritingDocument);
      const ordered = orderedWritingDocuments(saved);
      const selected = ordered.find(document => document.id === activeId);
      if (selected) suppressSavedVersion.current = { id: selected.id, version: selected.version };
      setDocuments(ordered);
      setSaveState('saved');
    } catch (error) {
      setSaveState(error instanceof Error && /changed on another device/i.test(error.message) ? 'conflict' : 'offline');
    }
  };

  const moveDocument = (documentId: string, direction: -1 | 1) => {
    void persistOutline(moveWritingDocument(documents, documentId, direction));
  };

  const assignScene = (chapterId?: string) => {
    if (!active) return;
    try { void persistOutline(reparentWritingScene(documents, active.id, chapterId)); }
    catch (error) { alert(error instanceof Error ? error.message : 'The scene could not be moved.'); }
  };

  const addDocument = (kind: WritingDocumentKind) => {
    const now = new Date().toISOString();
    const parent = kind === 'scene' && active?.kind === 'chapter' ? active.id : undefined;
    const sameKind = documents.filter(item => item.kind === kind).length;
    const created = saveWritingDocument({
      id: crypto.randomUUID(), project_id: universe.id, parent_id: parent,
      title: sameKind ? `${KIND_LABELS[kind]} ${sameKind + 1}` : KIND_LABELS[kind], kind, status: 'outline',
      content: kind === 'title_page' ? universe.name : '',
      order: documents.length, word_target: kind === 'chapter' ? 3000 : kind === 'scene' ? 1000 : undefined,
      created_at: now, updated_at: now,
    });
    setDocuments(current => [...current, created]);
    setActiveId(created.id);
    if (isDbMode()) void dbSaveWritingDocument(universe.id, created)
      .then(saved => {
        suppressSavedVersion.current = { id: saved.id, version: saved.version };
        saveWritingDocument(saved);
        setDocuments(current => current.map(item => item.id === saved.id ? saved : item));
      })
      .catch(() => setSaveState('offline'));
  };

  const removeActive = async () => {
    if (!active || !confirm(`Delete “${active.title}” and any documents nested beneath it?`)) return;
    deleteWritingDocument(universe.id, active.id);
    if (isDbMode()) {
      try { await dbDeleteWritingDocument(active.id); }
      catch { setSaveState('offline'); }
    }
    const remaining = getWritingDocuments(universe.id);
    setDocuments(remaining);
    setActiveId(remaining[0]?.id);
  };

  const applyWritingTemplate = async () => {
    const type = universe.production_type ?? 'novel';
    const template = WRITING_TEMPLATES[type];
    const additions = instantiateWritingTemplate(type, universe.id, universe.name, documents, () => crypto.randomUUID());
    if (!additions.length) { alert(`${template.label} sections are already present.`); return; }
    if (!confirm(`Add ${additions.length} missing ${template.label} section${additions.length === 1 ? '' : 's'}? Existing writing will not be changed.`)) return;
    setSaveState('saving');
    try {
      const saved: WritingDocument[] = [];
      for (const document of additions) {
        let next = saveWritingDocument(document);
        if (isDbMode()) next = await dbSaveWritingDocument(universe.id, next);
        saveWritingDocument(next); saved.push(next);
      }
      setDocuments(current => [...current, ...saved]); setActiveId(saved[0]?.id); setSaveState('saved');
    } catch { setSaveState('offline'); }
  };

  const openHistory = async () => {
    if (!active || !isDbMode()) return;
    setShowHistory(true);
    try { setRevisions(await dbGetWritingDocumentRevisions(active.id)); }
    catch { setRevisions([]); }
  };

  const reloadCloudDocument = async () => {
    const cloud = await dbGetWritingDocuments(universe.id);
    cloud.forEach(saveWritingDocument);
    setDocuments(cloud);
    setActiveId(current => cloud.some(item => item.id === current) ? current : cloud[0]?.id);
    setSaveState('saved');
  };

  const restoreRevision = async (revision: WritingDocumentRevision) => {
    if (!active || !confirm(`Restore version ${revision.version} from ${new Date(revision.created_at).toLocaleString()}? Your current draft will be preserved.`)) return;
    const restored = await dbRestoreWritingDocument(active.id, revision.id);
    suppressSavedVersion.current = { id: restored.id, version: restored.version };
    saveWritingDocument(restored);
    setDocuments(current => current.map(item => item.id === restored.id ? restored : item));
    setRevisions(await dbGetWritingDocumentRevisions(active.id));
    setSaveState('saved');
  };

  const downloadContent = (content: string, filename: string, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPackage = (content: Uint8Array, filename: string, type: string) => {
    const blob = new Blob([content as BlobPart], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadActive = (extension: 'txt' | 'md') => {
    if (active) downloadContent(documentExport(active, extension === 'md'), safeExportName(active.title, extension));
  };

  const downloadProject = (extension: 'txt' | 'md') => {
    downloadContent(compileWritingProject(universe.name, documents, extension === 'md'), safeExportName(universe.name, extension));
  };

  const downloadPublishingPackage = (format: 'docx' | 'epub') => {
    if (!publishingReadiness.ready) {
      alert(`Publishing is blocked by ${publishingReadiness.errors} preflight error${publishingReadiness.errors === 1 ? '' : 's'}. Review Publishing readiness first.`);
      return;
    }
    const content = format === 'docx' ? createDocxPackage(universe.name, documents, metadata) : createEpubPackage(universe.name, documents, metadata);
    const type = format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/epub+zip';
    downloadPackage(content, safeExportName(universe.name, format), type);
  };

  const downloadProfile = () => {
    const profile = getExportProfile(exportProfileId);
    const selected = documentsForExportProfile(documents, profile);
    if (!selected.length) { alert(`${profile.label} has no matching documents. Reader EPUB requires documents marked Final.`); return; }
    const content = profile.format === 'docx' ? createDocxPackage(universe.name, selected, metadata, { includeNotes: profile.include_notes }) : createEpubPackage(universe.name, selected, metadata);
    const type = profile.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/epub+zip';
    downloadPackage(content, safeExportName(`${universe.name}-${profile.id}`, profile.format), type);
  };

  const downloadBackup = () => {
    const backup = createWritingBackup({ id: universe.id, name: universe.name, production_type: universe.production_type }, documents);
    downloadContent(`${JSON.stringify(backup, null, 2)}\n`, safeExportName(`${universe.name}-writing-backup`, 'json'), 'application/json;charset=utf-8');
  };

  const importBackup = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('Writing backups are limited to 5 MiB.'); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const imported = importWritingBackup(parsed, universe.id, () => crypto.randomUUID());
      if (!imported.length || !confirm(`Import ${imported.length} documents into ${universe.name}? Existing work will not be replaced.`)) return;
      const saved: WritingDocument[] = [];
      for (const document of imported) {
        let next = saveWritingDocument(document);
        if (isDbMode()) next = await dbSaveWritingDocument(universe.id, next);
        saveWritingDocument(next);
        saved.push(next);
      }
      setDocuments(current => [...current, ...saved]);
      setActiveId(saved[0]?.id);
      setSaveState('saved');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'The writing backup could not be imported.');
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_240px] gap-4 min-h-[70vh]">
        <aside className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest">Production outline</h2>
            <span className="text-xs text-gray-600">{totalWords.toLocaleString()} words</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button size="sm" variant="secondary" onClick={() => addDocument('chapter')}>+ Chapter</Button>
            <Button size="sm" variant="ghost" onClick={() => addDocument('scene')}>+ Scene</Button>
            <Button size="sm" variant="ghost" onClick={() => addDocument('title_page')}>+ Front</Button>
            <Button size="sm" variant="ghost" onClick={() => addDocument('acknowledgements')}>+ Back</Button>
          </div>
          <div className="space-y-1">
            {orderedWritingDocuments(documents).map(item => (
              <div key={item.id} className={`group flex items-center rounded-lg border transition-colors ${item.id === activeId ? 'bg-[#c9a84c]/10 border-[#c9a84c]/50 text-white' : 'border-transparent text-gray-400 hover:bg-white/5'}`}
                style={{ marginLeft: item.parent_id ? '1rem' : undefined }}>
                <button onClick={() => setActiveId(item.id)} className="min-w-0 flex-1 text-left px-3 py-2">
                  <span className="block text-sm font-medium truncate">{item.kind === 'scene' ? '◦' : '▤'} {item.title}</span>
                  <span className="text-[10px] text-gray-600">{KIND_LABELS[item.kind]} · {countWords(item.content)} words</span>
                </button>
                <div className="flex pr-1 opacity-60 group-hover:opacity-100">
                  <button aria-label={`Move ${item.title} up`} title="Move up" onClick={() => moveDocument(item.id, -1)} className="px-1.5 py-2 text-xs hover:text-[#c9a84c]">↑</button>
                  <button aria-label={`Move ${item.title} down`} title="Move down" onClick={() => moveDocument(item.id, 1)} className="px-1.5 py-2 text-xs hover:text-[#c9a84c]">↓</button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl overflow-hidden flex flex-col">
          {active ? <>
            <div className="border-b border-[#c9a84c]/10 px-5 py-4">
              <input value={active.title} onChange={event => updateActive({ title: event.target.value })}
                aria-label="Document title" className="w-full bg-transparent text-xl font-semibold text-white outline-none placeholder:text-gray-700" placeholder="Untitled document" />
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                <span>{activeWords.toLocaleString()} words</span><span>•</span>
                <span className={saveState === 'saved' ? 'text-green-500' : saveState === 'conflict' ? 'text-red-400' : saveState === 'offline' ? 'text-yellow-500' : 'text-[#c9a84c]'}>
                  {saveState === 'saved' ? (isDbMode() ? `Saved to cloud · v${active.version ?? 1}` : 'Saved locally') : saveState === 'conflict' ? 'Newer cloud version found' : saveState === 'offline' ? 'Offline copy saved' : 'Saving…'}
                </span>
                {saveState === 'conflict' && <button onClick={() => void reloadCloudDocument()} className="text-red-300 underline">Reload cloud copy</button>}
              </div>
            </div>
            <textarea value={active.content} onChange={event => updateActive({ content: event.target.value })}
              aria-label="Document content" placeholder="Start writing…"
              className="flex-1 min-h-[560px] w-full resize-none bg-[#0b0b12] px-6 sm:px-12 py-10 text-[17px] leading-8 text-gray-200 font-serif outline-none placeholder:text-gray-700" />
          </> : <div className="flex flex-1 items-center justify-center text-gray-600">Create a chapter or scene to begin.</div>}
        </main>

        <aside className="space-y-4">
          {active && <>
            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4 space-y-4">
              <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest">Document</h2>
              <div><p className="text-xs text-gray-500">Production template</p><p className="mt-1 text-sm text-white">{WRITING_TEMPLATES[universe.production_type ?? 'novel'].label}</p><Button className="w-full mt-2" size="sm" variant="ghost" onClick={() => void applyWritingTemplate()}>Add missing template sections</Button></div>
              <label className="block text-xs text-gray-500">Type
                <select value={active.kind} onChange={event => updateActive({ kind: event.target.value as WritingDocumentKind })} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white">
                  {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs text-gray-500">Status
                <select value={active.status} onChange={event => updateActive({ status: event.target.value as WritingDocumentStatus })} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white">
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {active.kind === 'scene' && <label className="block text-xs text-gray-500">Chapter
                <select value={active.parent_id ?? ''} onChange={event => assignScene(event.target.value || undefined)} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white">
                  <option value="">Unassigned scene</option>
                  {documents.filter(document => document.kind === 'chapter').map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
                </select>
              </label>}
              <label className="block text-xs text-gray-500">Word target
                <input type="number" min="0" value={active.word_target ?? ''} onChange={event => updateActive({ word_target: Number(event.target.value) || undefined })} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" />
              </label>
              {active.word_target && <div><div className="h-1.5 bg-white/5 rounded overflow-hidden"><div className="h-full bg-[#c9a84c]" style={{ width: `${progress}%` }} /></div><p className="text-[10px] text-gray-600 mt-1">{progress}% of target</p></div>}
            </div>
            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
              <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest mb-3">Project search</h2>
              <input value={searchQuery} onChange={event => { setSearchQuery(event.target.value); selectSearchResults(event.target.value); }} maxLength={200} placeholder="Find in manuscript" aria-label="Project search query" className="w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" />
              <input value={replacement} onChange={event => setReplacement(event.target.value)} maxLength={5000} placeholder="Replace with" aria-label="Project replacement text" className="mt-2 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" />
              <div className="flex gap-3 mt-2 text-[11px] text-gray-500"><label><input type="checkbox" checked={caseSensitive} onChange={event => { setCaseSensitive(event.target.checked); selectSearchResults(searchQuery, event.target.checked, wholeWord); }} /> Match case</label><label><input type="checkbox" checked={wholeWord} onChange={event => { setWholeWord(event.target.checked); selectSearchResults(searchQuery, caseSensitive, event.target.checked); }} /> Whole word</label></div>
              {searchQuery.trim() && <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">{searchResults.length ? searchResults.map(result => <label key={result.document_id} className="block p-2 rounded border border-white/10 text-xs"><span className="flex justify-between gap-2 text-white"><span><input type="checkbox" checked={selectedSearchIds.has(result.document_id)} onChange={event => setSelectedSearchIds(current => { const next = new Set(current); if (event.target.checked) next.add(result.document_id); else next.delete(result.document_id); return next; })} /> {result.title}</span><span className="text-[#c9a84c]">{result.matches}</span></span><span className="mt-1 block text-[10px] text-gray-600">{result.preview}</span></label>) : <p className="text-xs text-gray-600">No manuscript matches.</p>}</div>}
              <Button className="w-full mt-3" size="sm" variant="secondary" disabled={!selectedMatches} onClick={() => void replaceSelectedMatches()}>Previewed replace · {selectedMatches}</Button>
            </div>
            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3"><h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest">Publishing metadata</h2><span className={`text-[10px] uppercase ${metadataState === 'error' ? 'text-red-400' : metadataState === 'saving' ? 'text-[#c9a84c]' : 'text-gray-600'}`}>{metadataState}</span></div>
              <div className="space-y-2">
                {([['author', 'Author'], ['publisher', 'Publisher'], ['language', 'Language'], ['isbn', 'ISBN']] as Array<[keyof PublishingMetadata, string]>).map(([field, label]) => <label key={field} className="block text-xs text-gray-500">{label}<input value={metadata[field] ?? ''} onChange={event => updateMetadata(field, event.target.value)} maxLength={field === 'language' ? 35 : field === 'isbn' ? 32 : 255} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" /></label>)}
                <label className="block text-xs text-gray-500">Description<textarea value={metadata.description ?? ''} onChange={event => updateMetadata('description', event.target.value)} maxLength={4000} rows={3} className="mt-1 w-full resize-y bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" /></label>
                <label className="block text-xs text-gray-500">Rights<textarea value={metadata.rights ?? ''} onChange={event => updateMetadata('rights', event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full resize-y bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" /></label>
                <Button className="w-full" size="sm" variant="secondary" disabled={metadataState === 'saving'} onClick={() => void persistMetadata()}>Save publishing metadata</Button>
              </div>
            </div>
            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
              <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest mb-3">Production files</h2>
              <label className="block text-xs text-gray-500 mb-2">Export profile<select value={exportProfileId} onChange={event => setExportProfileId(event.target.value)} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white">{EXPORT_PROFILES.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
              <p className="text-[10px] text-gray-600 mb-2">{getExportProfile(exportProfileId).description}</p>
              <Button className="w-full mb-3" size="sm" variant="secondary" disabled={!publishingReadiness.ready} onClick={downloadProfile}>Build selected package</Button>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Entire project</p>
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => downloadProject('txt')}>Full .TXT</Button><Button size="sm" variant="secondary" onClick={() => downloadProject('md')}>Full .MD</Button></div>
              <div className="grid grid-cols-2 gap-2 mt-2"><Button size="sm" variant="secondary" disabled={!publishingReadiness.ready} onClick={() => downloadPublishingPackage('docx')}>Editor .DOCX</Button><Button size="sm" variant="secondary" disabled={!publishingReadiness.ready} onClick={() => downloadPublishingPackage('epub')}>Reader .EPUB</Button></div>
              <Button className="w-full mt-2" size="sm" variant="ghost" onClick={downloadBackup}>JSON backup</Button>
              <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importBackup(file); }} />
              <Button className="w-full mt-2" size="sm" variant="ghost" onClick={() => importInput.current?.click()}>Import backup</Button>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-4 mb-2">Current document</p>
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => downloadActive('txt')}>.TXT</Button><Button size="sm" variant="secondary" onClick={() => downloadActive('md')}>.MD</Button></div>
              {isDbMode() && <Button className="w-full mt-3" size="sm" variant="ghost" onClick={() => void openHistory()}>Revision history</Button>}
              <button onClick={() => void removeActive()} className="mt-4 text-xs text-red-400 hover:text-red-300">Delete document</button>
            </div>
            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest">Publishing readiness</h2><span className={`text-[10px] font-bold uppercase ${publishingReadiness.ready ? 'text-green-500' : 'text-red-400'}`}>{publishingReadiness.ready ? 'Ready' : 'Blocked'}</span></div>
              <p className="mt-2 text-xs text-gray-500">{publishingReadiness.total_words.toLocaleString()} words · {publishingReadiness.publishable_documents} files · {publishingReadiness.errors} errors · {publishingReadiness.warnings} warnings</p>
              {publishingReadiness.issues.length === 0 ? <p className="mt-3 text-xs text-green-500">No structural publishing issues found.</p> : <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">{publishingReadiness.issues.slice(0, 12).map((issue, index) => <li key={`${issue.code}-${issue.document_id ?? index}`} className={`text-xs ${issue.severity === 'error' ? 'text-red-300' : 'text-yellow-400'}`}>{issue.severity === 'error' ? '●' : '△'} {issue.message}</li>)}</ul>}
              {publishingReadiness.issues.length > 12 && <p className="mt-2 text-[10px] text-gray-600">+{publishingReadiness.issues.length - 12} additional findings</p>}
            </div>
            {showHistory && isDbMode() && <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3"><h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest">Recovery points</h2><button onClick={() => setShowHistory(false)} className="text-gray-600">×</button></div>
              {revisions.length === 0 ? <p className="text-xs text-gray-600">Recovery points appear as you continue writing.</p> : <div className="space-y-2 max-h-64 overflow-y-auto">{revisions.map(revision => <button key={revision.id} onClick={() => void restoreRevision(revision)} className="w-full text-left p-2 rounded border border-white/10 hover:border-[#c9a84c]/50"><span className="block text-xs text-white">Version {revision.version}</span><span className="text-[10px] text-gray-600">{new Date(revision.created_at).toLocaleString()} · {countWords(revision.content)} words</span></button>)}</div>}
            </div>}
          </>}
        </aside>
      </div>
    </div>
  );
}
