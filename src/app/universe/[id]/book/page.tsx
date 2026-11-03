'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { getUniverseById, getWritingDocuments, saveUniverse } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetProject, dbGetWritingDocuments, dbUpdateProject } from '@/lib/db-client';
import {
  BOOK_TRIM_PRESETS,
  DEFAULT_BOOK_LAYOUT,
  buildBookPrintHtml,
  loadBookLayoutSettings,
  saveBookLayoutSettings,
  type BookLayoutSettings,
  type BookTrimPresetId,
} from '@/lib/book-production';
import { createDocxPackage, createEpubPackage } from '@/lib/publishing-packages';
import { analyzePublishingReadiness } from '@/lib/publishing-preflight';
import { EMPTY_PUBLISHING_METADATA, normalizePublishingMetadata } from '@/lib/publishing-metadata';
import { safeExportName } from '@/lib/writing-documents';
import type { PublishingMetadata, Universe, WritingDocument } from '@/lib/types';

interface BookStudioPageProps {
  params: Promise<{ id: string }>;
}

function downloadBytes(bytes: Uint8Array, filename: string, type: string): void {
  const blob = new Blob([bytes.slice().buffer], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function BookStudioPage({ params }: BookStudioPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Universe | null>(null);
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [layout, setLayout] = useState<BookLayoutSettings>(DEFAULT_BOOK_LAYOUT);
  const [metadata, setMetadata] = useState<PublishingMetadata>(EMPTY_PUBLISHING_METADATA);
  const [loading, setLoading] = useState(true);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedProject = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (!loadedProject || cancelled) return;
        setProject(loadedProject);
        setMetadata({ ...EMPTY_PUBLISHING_METADATA, ...normalizePublishingMetadata(loadedProject.publishing_metadata) });
        const loadedDocuments = isDbMode() ? await dbGetWritingDocuments(id) : getWritingDocuments(id);
        if (!cancelled) {
          setDocuments(loadedDocuments);
          setLayout(loadBookLayoutSettings(id));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (loading) return;
    const handle = window.setTimeout(() => saveBookLayoutSettings(id, layout), 200);
    return () => window.clearTimeout(handle);
  }, [id, layout, loading]);

  const readiness = useMemo(
    () => analyzePublishingReadiness(project?.name || '', documents, metadata),
    [documents, metadata, project?.name],
  );

  const finalDocuments = useMemo(
    () => documents.filter(document => document.kind !== 'notes' && document.status === 'final').length,
    [documents],
  );

  const saveMetadata = async () => {
    if (!project || savingMetadata) return;
    setSavingMetadata(true);
    setStatus('');
    try {
      const normalized = normalizePublishingMetadata(metadata);
      if (isDbMode()) {
        const updated = await dbUpdateProject(project.id, { ...project, publishing_metadata: normalized });
        setProject(updated);
      } else {
        const updated = { ...project, publishing_metadata: normalized, updated_at: new Date().toISOString() };
        saveUniverse(updated);
        setProject(updated);
      }
      setMetadata(normalized);
      setStatus('Publishing metadata saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save publishing metadata.');
    } finally {
      setSavingMetadata(false);
    }
  };

  const exportDocx = () => {
    if (!project) return;
    if (!readiness.ready) {
      setStatus(`DOCX blocked by ${readiness.errors} publishing preflight error${readiness.errors === 1 ? '' : 's'}.`);
      return;
    }
    const bytes = createDocxPackage(project.name, documents, metadata);
    downloadBytes(bytes, safeExportName(project.name, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    setStatus('DOCX manuscript exported.');
  };

  const exportEpub = () => {
    if (!project) return;
    if (!readiness.ready) {
      setStatus(`EPUB blocked by ${readiness.errors} publishing preflight error${readiness.errors === 1 ? '' : 's'}.`);
      return;
    }
    const bytes = createEpubPackage(project.name, documents, metadata);
    downloadBytes(bytes, safeExportName(project.name, 'epub'), 'application/epub+zip');
    setStatus('EPUB reader edition exported.');
  };

  const openPrintProof = () => {
    if (!project) return;
    if (!readiness.ready) {
      setStatus(`Print proof blocked by ${readiness.errors} publishing preflight error${readiness.errors === 1 ? '' : 's'}.`);
      return;
    }
    const html = buildBookPrintHtml(project.name, documents, metadata, layout);
    const popup = window.open('', '_blank');
    if (!popup) {
      setStatus('Popup blocked. Allow popups for Phoenix to open the print proof.');
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 450);
  };

  if (loading || !project) {
    return (
      <Navigation>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner text="Opening Book Production..." />
        </div>
      </Navigation>
    );
  }

  const trim = BOOK_TRIM_PRESETS.find(preset => preset.id === layout.trimPreset) || BOOK_TRIM_PRESETS[0];

  return (
    <Navigation>
      <Header
        title="Book Production"
        subtitle={`Professional manuscript and print layout for ${project.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => router.push(`/universe/${id}/stories`)}>Writing Room</Button>
            <Button size="sm" variant="ghost" onClick={() => router.push(`/universe/${id}/design`)}>Design Cover</Button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#0a1020] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Publishing readiness</p>
                  <h2 className="mt-2 text-2xl font-black text-white">{readiness.ready ? 'Ready for package export' : 'Preflight needs attention'}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {readiness.publishable_documents} publishable documents · {readiness.total_words.toLocaleString()} words · {finalDocuments} final
                  </p>
                </div>
                <div className={`rounded-xl border px-4 py-3 text-center ${readiness.ready ? 'border-emerald-400/25 bg-emerald-400/10' : 'border-amber-400/25 bg-amber-400/10'}`}>
                  <div className={`text-2xl font-black ${readiness.ready ? 'text-emerald-300' : 'text-amber-300'}`}>{readiness.errors}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Errors</div>
                </div>
              </div>

              {readiness.issues.length > 0 && (
                <div className="mt-5 max-h-64 space-y-2 overflow-auto">
                  {readiness.issues.map((issue, index) => (
                    <div key={`${issue.code}-${issue.document_id || index}`} className={`rounded-lg border px-3 py-2 text-xs ${issue.severity === 'error' ? 'border-red-400/20 bg-red-400/5 text-red-200' : 'border-amber-400/20 bg-amber-400/5 text-amber-200'}`}>
                      <span className="mr-2 font-black uppercase">{issue.severity}</span>{issue.message}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0a1020] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Trim & print layout</p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-xs text-slate-400">Trim size
                  <select
                    value={layout.trimPreset}
                    onChange={event => setLayout(current => ({ ...current, trimPreset: event.target.value as BookTrimPresetId }))}
                    className="mt-1 min-h-11 w-full rounded border border-white/10 bg-[#080c15] px-3 text-white"
                  >
                    {BOOK_TRIM_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-600">{trim.description}</span>
                </label>
                <label className="text-xs text-slate-400">Bleed target (in)
                  <input type="number" min={0} max={0.5} step={0.025} value={layout.bleedIn} onChange={event => setLayout(current => ({ ...current, bleedIn: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
                <label className="text-xs text-slate-400">Gutter (in)
                  <input type="number" min={0.25} max={2} step={0.025} value={layout.gutterIn} onChange={event => setLayout(current => ({ ...current, gutterIn: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
                <label className="text-xs text-slate-400">Outside margin (in)
                  <input type="number" min={0.25} max={2} step={0.025} value={layout.outsideMarginIn} onChange={event => setLayout(current => ({ ...current, outsideMarginIn: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
                <label className="text-xs text-slate-400">Top margin (in)
                  <input type="number" min={0.25} max={2} step={0.025} value={layout.topMarginIn} onChange={event => setLayout(current => ({ ...current, topMarginIn: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
                <label className="text-xs text-slate-400">Bottom margin (in)
                  <input type="number" min={0.25} max={2} step={0.025} value={layout.bottomMarginIn} onChange={event => setLayout(current => ({ ...current, bottomMarginIn: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
                <label className="text-xs text-slate-400">Body font (pt)
                  <input type="number" min={8} max={18} step={0.5} value={layout.fontSizePt} onChange={event => setLayout(current => ({ ...current, fontSizePt: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
                <label className="text-xs text-slate-400">Line height
                  <input type="number" min={1} max={2.2} step={0.05} value={layout.lineHeight} onChange={event => setLayout(current => ({ ...current, lineHeight: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0a1020] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Finished book outputs</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button variant="gold" disabled={!readiness.ready} onClick={exportDocx}>Export DOCX</Button>
                <Button variant="secondary" disabled={!readiness.ready} onClick={exportEpub}>Export EPUB</Button>
                <Button variant="secondary" disabled={!readiness.ready} onClick={openPrintProof}>Print-layout PDF</Button>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                DOCX and EPUB use Phoenix&apos;s package generator. Print-layout PDF opens a trim-aware browser proof; commercial printer/KDP/Ingram preflight requirements remain authoritative for final press submission.
              </p>
              {status && <p className="mt-3 text-xs text-blue-200">{status}</p>}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#080c15] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Publishing metadata</p>
              <div className="mt-4 space-y-3">
                {([
                  ['author', 'Author'],
                  ['publisher', 'Publisher'],
                  ['language', 'Language'],
                  ['isbn', 'ISBN'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-xs text-slate-400">{label}
                    <input value={metadata[key] || ''} onChange={event => setMetadata(current => ({ ...current, [key]: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-white/10 bg-black/20 px-3 text-white" />
                  </label>
                ))}
                <label className="block text-xs text-slate-400">Description
                  <textarea value={metadata.description || ''} onChange={event => setMetadata(current => ({ ...current, description: event.target.value }))} className="mt-1 min-h-24 w-full rounded border border-white/10 bg-black/20 p-3 text-white" />
                </label>
                <label className="block text-xs text-slate-400">Rights
                  <textarea value={metadata.rights || ''} onChange={event => setMetadata(current => ({ ...current, rights: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-white/10 bg-black/20 p-3 text-white" />
                </label>
                <Button className="w-full" size="sm" variant="secondary" loading={savingMetadata} onClick={() => void saveMetadata()}>Save Metadata</Button>
              </div>
            </section>

            <section className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] p-5">
              <div className="text-sm font-black text-white">Production chain</div>
              <div className="mt-3 space-y-2 text-xs text-slate-400">
                <button type="button" onClick={() => router.push(`/universe/${id}/stories`)} className="min-h-11 w-full rounded border border-white/10 px-3 text-left hover:border-violet-400/40">1. Write & finalize manuscript</button>
                <button type="button" onClick={() => router.push(`/universe/${id}/illustrate`)} className="min-h-11 w-full rounded border border-white/10 px-3 text-left hover:border-violet-400/40">2. Create illustrations</button>
                <button type="button" onClick={() => router.push(`/universe/${id}/design`)} className="min-h-11 w-full rounded border border-white/10 px-3 text-left hover:border-violet-400/40">3. Design cover & promotional art</button>
                <button type="button" onClick={() => router.push(`/universe/${id}/export`)} className="min-h-11 w-full rounded border border-white/10 px-3 text-left hover:border-violet-400/40">4. Publish project deliverables</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Navigation>
  );
}
