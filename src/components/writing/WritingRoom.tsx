'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteWritingDocument, getWritingDocuments, saveWritingDocument } from '@/lib/storage';
import { compileWritingProject, countWords, createWritingBackup, documentExport, importWritingBackup, safeExportName } from '@/lib/writing-documents';
import { createDocxPackage, createEpubPackage } from '@/lib/publishing-packages';
import { isDbMode } from '@/lib/storage-mode';
import { dbDeleteWritingDocument, dbGetWritingDocumentRevisions, dbGetWritingDocuments, dbRestoreWritingDocument, dbSaveWritingDocument } from '@/lib/db-client';
import type { Universe, WritingDocument, WritingDocumentKind, WritingDocumentRevision, WritingDocumentStatus } from '@/lib/types';

const KIND_LABELS: Record<WritingDocumentKind, string> = {
  manuscript: 'Manuscript', chapter: 'Chapter', scene: 'Scene', screenplay: 'Screenplay', comic_script: 'Comic Script', notes: 'Notes',
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

  const updateActive = (patch: Partial<WritingDocument>) => {
    if (!activeId) return;
    setDocuments(current => current.map(item => item.id === activeId ? { ...item, ...patch } : item));
  };

  const addDocument = (kind: WritingDocumentKind) => {
    const now = new Date().toISOString();
    const parent = kind === 'scene' && active?.kind === 'chapter' ? active.id : undefined;
    const sameKind = documents.filter(item => item.kind === kind).length;
    const created = saveWritingDocument({
      id: crypto.randomUUID(), project_id: universe.id, parent_id: parent,
      title: `${KIND_LABELS[kind]} ${sameKind + 1}`, kind, status: 'outline', content: '',
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
    const content = format === 'docx' ? createDocxPackage(universe.name, documents) : createEpubPackage(universe.name, documents);
    const type = format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/epub+zip';
    downloadPackage(content, safeExportName(universe.name, format), type);
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
          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="secondary" onClick={() => addDocument('chapter')}>+ Chapter</Button>
            <Button size="sm" variant="ghost" onClick={() => addDocument('scene')}>+ Scene</Button>
          </div>
          <div className="space-y-1">
            {documents.map(item => (
              <button key={item.id} onClick={() => setActiveId(item.id)}
                className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${item.id === activeId ? 'bg-[#c9a84c]/10 border-[#c9a84c]/50 text-white' : 'border-transparent text-gray-400 hover:bg-white/5'}`}
                style={{ paddingLeft: item.parent_id ? '2rem' : undefined }}>
                <span className="block text-sm font-medium truncate">{item.kind === 'scene' ? '◦' : '▤'} {item.title}</span>
                <span className="text-[10px] text-gray-600">{KIND_LABELS[item.kind]} · {countWords(item.content)} words</span>
              </button>
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
              <label className="block text-xs text-gray-500">Word target
                <input type="number" min="0" value={active.word_target ?? ''} onChange={event => updateActive({ word_target: Number(event.target.value) || undefined })} className="mt-1 w-full bg-[#09090f] border border-white/10 rounded px-2 py-2 text-sm text-white" />
              </label>
              {active.word_target && <div><div className="h-1.5 bg-white/5 rounded overflow-hidden"><div className="h-full bg-[#c9a84c]" style={{ width: `${progress}%` }} /></div><p className="text-[10px] text-gray-600 mt-1">{progress}% of target</p></div>}
            </div>
            <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4">
              <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest mb-3">Production files</h2>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Entire project</p>
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => downloadProject('txt')}>Full .TXT</Button><Button size="sm" variant="secondary" onClick={() => downloadProject('md')}>Full .MD</Button></div>
              <div className="grid grid-cols-2 gap-2 mt-2"><Button size="sm" variant="secondary" onClick={() => downloadPublishingPackage('docx')}>Editor .DOCX</Button><Button size="sm" variant="secondary" onClick={() => downloadPublishingPackage('epub')}>Reader .EPUB</Button></div>
              <Button className="w-full mt-2" size="sm" variant="ghost" onClick={downloadBackup}>JSON backup</Button>
              <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importBackup(file); }} />
              <Button className="w-full mt-2" size="sm" variant="ghost" onClick={() => importInput.current?.click()}>Import backup</Button>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-4 mb-2">Current document</p>
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => downloadActive('txt')}>.TXT</Button><Button size="sm" variant="secondary" onClick={() => downloadActive('md')}>.MD</Button></div>
              {isDbMode() && <Button className="w-full mt-3" size="sm" variant="ghost" onClick={() => void openHistory()}>Revision history</Button>}
              <button onClick={() => void removeActive()} className="mt-4 text-xs text-red-400 hover:text-red-300">Delete document</button>
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
