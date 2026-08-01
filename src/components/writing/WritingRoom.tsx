'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteWritingDocument, getWritingDocuments, saveWritingDocument } from '@/lib/storage';
import { countWords, documentExport, safeExportName } from '@/lib/writing-documents';
import { isDbMode } from '@/lib/storage-mode';
import { dbDeleteWritingDocument, dbGetWritingDocuments, dbSaveWritingDocument } from '@/lib/db-client';
import type { Universe, WritingDocument, WritingDocumentKind, WritingDocumentStatus } from '@/lib/types';

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
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');
  const loaded = useRef(false);
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
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      const local = saveWritingDocument(active);
      if (isDbMode()) {
        void dbSaveWritingDocument(universe.id, local)
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('offline'));
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
    if (isDbMode()) void dbSaveWritingDocument(universe.id, created).catch(() => setSaveState('offline'));
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

  const download = (extension: 'txt' | 'md') => {
    if (!active) return;
    const blob = new Blob([documentExport(active, extension === 'md')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeExportName(active.title, extension);
    link.click();
    URL.revokeObjectURL(url);
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
                <span className={saveState === 'saved' ? 'text-green-500' : saveState === 'offline' ? 'text-yellow-500' : 'text-[#c9a84c]'}>
                  {saveState === 'saved' ? (isDbMode() ? 'Saved to cloud' : 'Saved locally') : saveState === 'offline' ? 'Offline copy saved' : 'Saving…'}
                </span>
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
              <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest mb-3">Export</h2>
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => download('txt')}>.TXT</Button><Button size="sm" variant="secondary" onClick={() => download('md')}>.MD</Button></div>
              <button onClick={() => void removeActive()} className="mt-4 text-xs text-red-400 hover:text-red-300">Delete document</button>
            </div>
          </>}
        </aside>
      </div>
    </div>
  );
}
