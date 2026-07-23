'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { getUniverseById, getCharacters, getScenes, getStoryboardPanels } from '@/lib/storage';
import { exportProjectToPrintableHtml } from '@/lib/pdf-exporter';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetProject, dbGetCharacters, dbGetScenes, dbExportProjectPdf } from '@/lib/db-client';
import type { Project, Character, Scene, StoryboardPanel } from '@/lib/types';

interface ExportPageProps {
  params: Promise<{ id: string }>;
}

export default function ExportPage({ params }: ExportPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const inDbMode = isDbMode();

  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyboardPanels, setStoryboardPanels] = useState<StoryboardPanel[]>([]);
  const [loading, setLoading] = useState(true);

  // Export states
  const [isExporting, setIsExporting] = useState(false);         // popup print (local)
  const [isServerExporting, setIsServerExporting] = useState(false); // Puppeteer PDF (DB)
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if (inDbMode) {
          // DB mode: pull live data for preview counts; server handles actual export data
          const [proj, chars, scns] = await Promise.all([
            dbGetProject(id).catch(() => null),
            dbGetCharacters(id),
            dbGetScenes(id),
          ]);
          if (!proj) { router.push('/dashboard'); return; }
          setProject(proj);
          setCharacters(chars);
          setScenes(scns);
          // Storyboard panel count is for display only; actual panels loaded server-side
          setStoryboardPanels([]);
        } else {
          // Local mode: unchanged behavior
          const proj = getUniverseById(id);
          if (!proj) { router.push('/dashboard'); return; }
          setProject(proj);
          const chars = getCharacters(id);
          setCharacters(chars);
          const scns = getScenes(id);
          setScenes(scns);
          const allPanels: StoryboardPanel[] = [];
          scns.forEach(s => { allPanels.push(...getStoryboardPanels(s.id)); });
          setStoryboardPanels(allPanels);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [id, router, inDbMode]);

  // ── Local popup print (unchanged) ──────────────────────────────────────────
  const handlePdfExport = () => {
    if (!project) return;
    setIsExporting(true);
    try {
      const htmlContent = exportProjectToPrintableHtml({
        project,
        characters,
        scenes,
        storyboardPanels,
      });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          setIsExporting(false);
        }, 800);
      } else {
        alert('Popup blocker prevented opening the print window. Please allow popups for this site.');
        setIsExporting(false);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate export packet.');
      setIsExporting(false);
    }
  };

  // ── Server-side Puppeteer PDF (DB mode) ────────────────────────────────────
  const handleServerPdfExport = async () => {
    if (!project) return;
    setIsServerExporting(true);
    setExportError('');
    try {
      const blob = await dbExportProjectPdf(id);
      // Build a safe filename matching the server's buildPdfFilename() logic
      const slug = project.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60);
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `${slug || 'project'}-${date}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF export failed';
      setExportError(msg);
    } finally {
      setIsServerExporting(false);
    }
  };

  // ── JSON backup ─────────────────────────────────────────────────
  const handleJsonExport = async () => {
    if (!project) return;
    if (inDbMode) {
      try {
        const res = await fetch(`/api/db/projects/${id}/export/json`);
        if (!res.ok) throw new Error('Failed to download JSON backup');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_export.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'JSON export failed');
      }
    } else {
      const exportData = {
        project,
        characters,
        scenes,
        storyboardPanels,
        exportedAt: new Date().toISOString(),
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `${project.name.toLowerCase().replace(/\s+/g, '_')}_export.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  if (loading) {
    return (
      <Navigation>
        <div className="flex items-center justify-center h-64">
          <Spinner text="Preparing export engine..." />
        </div>
      </Navigation>
    );
  }

  if (!project) return null;

  return (
    <Navigation>
      <Header
        title="Export Center"
        subtitle={`Generate output documents for: ${project.name}`}
      />

      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">

        {/* Error banner */}
        {exportError && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-red-400 text-lg shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-300">PDF Export Failed</p>
              <p className="text-xs text-red-400/80 mt-0.5">{exportError}</p>
            </div>
            <button
              onClick={() => setExportError('')}
              className="ml-auto text-red-400/60 hover:text-red-300 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Export Selector Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border border-[#c9a84c]/20 bg-[#0c0c14] p-6 flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Production Packet (PDF)</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Compile a comprehensive document containing the project bible, character profiles,
                chronological scenes, and storyboard panels with image references.
              </p>

              {inDbMode && (
                <div className="bg-emerald-400/5 border border-emerald-400/20 rounded p-3 mb-4">
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    <span className="font-bold">🖨️ DB Mode active.</span> &quot;Download PDF&quot; renders a real PDF
                    server-side — storyboard asset images are embedded automatically.
                    The popup option is still available if you prefer browser printing.
                  </p>
                </div>
              )}

              <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
                <li>Professional title page formatting</li>
                <li>Grid system for character profile comparison</li>
                <li>Chronological scene outline lists</li>
                {inDbMode
                  ? <li>Storyboard panels with <strong className="text-emerald-400">embedded Asset Library images</strong></li>
                  : <li>Visual grid layout for storyboards with sketch previews</li>
                }
                {inDbMode && <li>Page numbers on every page</li>}
              </ul>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-[#c9a84c]/10">
              {/* Primary: server PDF in DB mode */}
              {inDbMode && (
                <Button
                  variant="gold"
                  onClick={handleServerPdfExport}
                  disabled={isServerExporting}
                  className="flex items-center gap-2"
                >
                  {isServerExporting ? <Spinner size="sm" /> : '📥'}{' '}
                  {isServerExporting ? 'Generating PDF…' : 'Download PDF'}
                </Button>
              )}

              {/* Popup print — available in both modes */}
              <Button
                variant={inDbMode ? 'ghost' : 'gold'}
                onClick={handlePdfExport}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                {isExporting ? <Spinner size="sm" /> : '🖨️'} Export &amp; Print PDF
              </Button>

              <Button
                variant="ghost"
                onClick={handleJsonExport}
                className="text-gray-400 hover:text-white"
              >
                Download JSON Backup
              </Button>
            </div>
          </Card>

          {/* Quick Stats Card */}
          <Card className="border border-white/5 bg-[#0a0a0f] p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c]/70">
              Packet Summary
            </h4>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">PROJECT:</span>
                <span className="text-white font-bold truncate max-w-[150px]">{project.name}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">MODE:</span>
                <span className={`font-bold ${inDbMode ? 'text-emerald-400' : 'text-[#c9a84c]'}`}>
                  {inDbMode ? 'Database' : 'Local'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">CHARACTERS:</span>
                <span className="text-white font-bold">{characters.length}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">SCENES:</span>
                <span className="text-white font-bold">{scenes.length}</span>
              </div>
              {!inDbMode && (
                <div className="flex justify-between pb-2">
                  <span className="text-gray-500">STORY PANELS:</span>
                  <span className="text-white font-bold">{storyboardPanels.length}</span>
                </div>
              )}
            </div>

            {inDbMode ? (
              <div className="bg-emerald-400/5 border border-emerald-400/20 rounded p-3 text-[11px] text-gray-400 leading-normal">
                💡 Storyboard panels and asset images are loaded server-side during PDF generation.
              </div>
            ) : (
              <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/20 rounded p-3 text-[11px] text-gray-400 leading-normal">
                💡 <strong>Tip:</strong> Set your print destination to <strong>&quot;Save as PDF&quot;</strong> in the browser print dialog to generate a digital PDF.
              </div>
            )}
          </Card>
        </div>

        {/* Detailed Content Preview */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c]/70">
            Export Document Outline
          </h3>

          <div className="space-y-3">
            <div className="bg-[#0f0f18] border border-white/5 rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">📖</span>
                <div>
                  <h5 className="text-sm font-bold text-white">Project Bible Meta</h5>
                  <p className="text-xs text-gray-500">Genre: {project.genre || 'N/A'} | Tone: {project.tone || 'N/A'}</p>
                </div>
              </div>
              <span className="text-xs text-[#c9a84c] font-mono">Page 1–2</span>
            </div>

            <div className="bg-[#0f0f18] border border-white/5 rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">👥</span>
                <div>
                  <h5 className="text-sm font-bold text-white">Character Profiles</h5>
                  <p className="text-xs text-gray-500">{characters.length} characters included in detail</p>
                </div>
              </div>
              <span className="text-xs text-[#c9a84c] font-mono">Page 3</span>
            </div>

            <div className="bg-[#0f0f18] border border-white/5 rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎬</span>
                <div>
                  <h5 className="text-sm font-bold text-white">Scene Beats List</h5>
                  <p className="text-xs text-gray-500">{scenes.length} narrative scenes organized by chronology</p>
                </div>
              </div>
              <span className="text-xs text-[#c9a84c] font-mono">Page 4</span>
            </div>

            <div className="bg-[#0f0f18] border border-white/5 rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🖼️</span>
                <div>
                  <h5 className="text-sm font-bold text-white">Storyboard Panels Grid</h5>
                  <p className="text-xs text-gray-500">
                    {inDbMode
                      ? 'All panels loaded server-side with embedded asset images'
                      : `${storyboardPanels.length} panels with visual prompts and sketch previews`
                    }
                  </p>
                </div>
              </div>
              <span className="text-xs text-[#c9a84c] font-mono">Page 5+</span>
            </div>
          </div>
        </div>

      </div>
    </Navigation>
  );
}
