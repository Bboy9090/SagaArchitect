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
import type { Project, Character, Scene, StoryboardPanel } from '@/lib/types';

interface ExportPageProps {
  params: Promise<{ id: string }>;
}

export default function ExportPage({ params }: ExportPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyboardPanels, setStoryboardPanels] = useState<StoryboardPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const proj = getUniverseById(id);
      if (!proj) {
        router.push('/dashboard');
        return;
      }
      setProject(proj);

      const chars = getCharacters(id);
      setCharacters(chars);

      const scns = getScenes(id);
      setScenes(scns);

      // Fetch panels for all scenes
      const allPanels: StoryboardPanel[] = [];
      scns.forEach(s => {
        const scenePanels = getStoryboardPanels(s.id);
        allPanels.push(...scenePanels);
      });
      setStoryboardPanels(allPanels);

      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [id, router]);

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
        
        // Give base64 sketches and styles some time to render
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

  const handleJsonExport = () => {
    if (!project) return;
    
    const exportData = {
      project,
      characters,
      scenes,
      storyboardPanels,
      exportedAt: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.name.toLowerCase().replace(/\s+/g, '_')}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
        
        {/* Main Export Selector Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border border-[#c9a84c]/20 bg-[#0c0c14] p-6 flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Production Packet (PDF)</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Compile a comprehensive print-ready document containing the project bible, character profiles, chronological scenes, and the storyboard panels with image sketches.
              </p>
              
              <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
                <li>Professional title page formatting</li>
                <li>Grid system for character profile comparison</li>
                <li>Chronological scene outline lists</li>
                <li>Visual grid layout for storyboards with sketch previews</li>
              </ul>
            </div>
            
            <div className="flex gap-3 pt-4 border-t border-[#c9a84c]/10">
              <Button
                variant="gold"
                onClick={handlePdfExport}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                {isExporting ? <Spinner size="sm" /> : '📥'} Export & Print PDF
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
                <span className="text-gray-500">CHARACTERS:</span>
                <span className="text-white font-bold">{characters.length}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">SCENES:</span>
                <span className="text-white font-bold">{scenes.length}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-gray-500">STORY PANELS:</span>
                <span className="text-white font-bold">{storyboardPanels.length}</span>
              </div>
            </div>

            <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/20 rounded p-3 text-[11px] text-gray-400 leading-normal">
              💡 <strong>Tip:</strong> Set your print destination to <strong>&quot;Save as PDF&quot;</strong> in the browser print dialog to generate a digital PDF document.
            </div>
          </Card>
        </div>

        {/* Detailed Content Preview */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c]/70">
            Export Document Outline
          </h3>

          <div className="space-y-3">
            {/* Outline: Project Meta */}
            <div className="bg-[#0f0f18] border border-white/5 rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">📖</span>
                <div>
                  <h5 className="text-sm font-bold text-white">Project Bible Meta</h5>
                  <p className="text-xs text-gray-500">Genre: {project.genre || 'N/A'} | Tone: {project.tone || 'N/A'}</p>
                </div>
              </div>
              <span className="text-xs text-[#c9a84c] font-mono">Page 1-2</span>
            </div>

            {/* Outline: Characters */}
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

            {/* Outline: Scenes */}
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

            {/* Outline: Storyboards */}
            <div className="bg-[#0f0f18] border border-white/5 rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🖼️</span>
                <div>
                  <h5 className="text-sm font-bold text-white">Storyboard Panels Grid</h5>
                  <p className="text-xs text-gray-500">{storyboardPanels.length} panels layout with visual prompt & text details</p>
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
