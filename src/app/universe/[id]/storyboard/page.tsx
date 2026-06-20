'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { getScenes, getStoryboardPanels, saveStoryboardPanel, deleteStoryboardPanel, getUniverseById } from '@/lib/storage';
import type { Scene, StoryboardPanel } from '@/lib/types';
import { isDbMode } from '@/lib/storage-mode';
import {
  dbGetScenes,
  dbGetStoryboardPanels,
  dbSaveStoryboardPanel,
  dbDeleteStoryboardPanel,
  dbGetAssets,
  dbClearStoryboardPanelAsset,
  type ProjectAsset,
} from '@/lib/db-client';

interface StoryboardPageProps {
  params: Promise<{ id: string }>;
}

const CAMERA_SHOT_OPTIONS = [
  'Wide Shot',
  'Medium Shot',
  'Close-Up',
  'Extreme Close-Up',
  'Over-the-Shoulder',
  'Low Angle',
  'High Angle',
  'Tracking Shot',
  'Establishing Shot',
];

// Which tab is active in the modal image column
type ImageTab = 'draw' | 'asset';

export default function StoryboardPage({ params }: StoryboardPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSceneId = searchParams.get('sceneId');
  const inDbMode = isDbMode();

  const [projectName, setProjectName] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [panels, setPanels] = useState<StoryboardPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState<StoryboardPanel | null>(null);

  // Project assets (DB mode only)
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>([]);

  // Form states
  const [panelNumber, setPanelNumber] = useState(1);
  const [visualPrompt, setVisualPrompt] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [dialogue, setDialogue] = useState('');
  const [cameraShot, setCameraShot] = useState('Medium Shot');
  const [imageBase64, setImageBase64] = useState<string>('');

  // Asset selection state (DB mode only)
  const [imageTab, setImageTab] = useState<ImageTab>('draw');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  // Per-panel attach/clear in-progress tracking
  const [attachingPanelId, setAttachingPanelId] = useState<string>('');

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#c9a84c');
  const [brushSize, setBrushSize] = useState(3);

  const fetchInitialData = useCallback(async () => {
    try {
      const u = getUniverseById(id);
      if (!u) {
        router.push('/dashboard');
        return;
      }
      setProjectName(u.name);

      const projectScenes = inDbMode ? await dbGetScenes(id) : getScenes(id);
      setScenes(projectScenes);

      // Load project assets in DB mode for the asset picker
      if (inDbMode) {
        const assets = await dbGetAssets(id);
        setProjectAssets(assets);
      }

      if (projectScenes.length > 0) {
        const activeScene = projectScenes.find(s => s.id === initialSceneId) || projectScenes[0];
        setSelectedSceneId(activeScene.id);
        const projectPanels = inDbMode ? await dbGetStoryboardPanels(activeScene.id) : getStoryboardPanels(activeScene.id);
        setPanels(projectPanels);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, initialSceneId, router, inDbMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitialData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitialData]);

  const handleSelectScene = async (sceneId: string) => {
    setSelectedSceneId(sceneId);
    try {
      if (inDbMode) {
        setPanels(await dbGetStoryboardPanels(sceneId));
      } else {
        setPanels(getStoryboardPanels(sceneId));
      }
    } catch (err) {
      console.error(err);
    }
    router.replace(`/universe/${id}/storyboard?sceneId=${sceneId}`);
  };

  // ─── Canvas drawing helpers ─────────────────────────────────────────────────
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCanvasToState();
  };

  const saveCanvasToState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setImageBase64(canvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f0f16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#c9a84c10';
    ctx.lineWidth = 1;
    for (let i = 20; i < canvas.width; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 20; i < canvas.height; i += 20) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    setImageBase64('');
  };

  const generateMockSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f0f16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#3b82f640';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    ctx.strokeStyle = '#c9a84c90';
    ctx.lineWidth = 2;
    const w = canvas.width, h = canvas.height;

    if (cameraShot.includes('Wide') || cameraShot.includes('Establishing')) {
      ctx.beginPath(); ctx.moveTo(0, h * 0.65); ctx.lineTo(w, h * 0.65); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.65); ctx.lineTo(w * 0.3, h * 0.3);
      ctx.lineTo(w * 0.5, h * 0.65); ctx.lineTo(w * 0.7, h * 0.25);
      ctx.lineTo(w * 0.9, h * 0.65); ctx.stroke();
      ctx.beginPath(); ctx.arc(w * 0.75, h * 0.4, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.4, h * 0.58, 4, 0, Math.PI * 2);
      ctx.moveTo(w * 0.4, h * 0.6); ctx.lineTo(w * 0.4, h * 0.63);
      ctx.moveTo(w * 0.39, h * 0.61); ctx.lineTo(w * 0.41, h * 0.61);
      ctx.moveTo(w * 0.4, h * 0.63); ctx.lineTo(w * 0.39, h * 0.65);
      ctx.moveTo(w * 0.4, h * 0.63); ctx.lineTo(w * 0.41, h * 0.65);
      ctx.stroke();
    } else if (cameraShot.includes('Close-Up') || cameraShot.includes('Extreme')) {
      ctx.beginPath(); ctx.arc(w / 2, h * 0.45, 45, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2 - 15, h * 0.42, 6, 0, Math.PI * 2);
      ctx.arc(w / 2 + 15, h * 0.42, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 25, h * 0.35); ctx.lineTo(w / 2 - 8, h * 0.38);
      ctx.moveTo(w / 2 + 25, h * 0.35); ctx.lineTo(w / 2 + 8, h * 0.38); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 12, h * 0.53);
      ctx.quadraticCurveTo(w / 2, h * 0.56, w / 2 + 12, h * 0.53); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(w / 2, h * 0.35, 25, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 30, h * 0.7); ctx.lineTo(w / 2 - 15, h * 0.48);
      ctx.lineTo(w / 2 + 15, h * 0.48); ctx.lineTo(w / 2 + 30, h * 0.7);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75); ctx.stroke();
    }

    ctx.fillStyle = '#c9a84c60';
    ctx.font = '9px monospace';
    ctx.fillText(`PHOENIX PREVIEW — ${cameraShot.toUpperCase()}`, 10, h - 12);
    saveCanvasToState();
  };

  // ─── Modal open helpers ─────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingPanel(null);
    setPanelNumber(panels.length > 0 ? Math.max(...panels.map(p => p.panel_number)) + 1 : 1);
    setVisualPrompt('');
    setActionDescription('');
    setDialogue('');
    setCameraShot('Medium Shot');
    setImageBase64('');
    setSelectedAssetId('');
    setImageTab('draw');
    setShowModal(true);
    setTimeout(() => { clearCanvas(); }, 100);
  };

  const handleOpenEdit = (panel: StoryboardPanel) => {
    setEditingPanel(panel);
    setPanelNumber(panel.panel_number);
    setVisualPrompt(panel.visual_prompt);
    setActionDescription(panel.action_description);
    setDialogue(panel.dialogue || '');
    setCameraShot(panel.camera_shot || 'Medium Shot');
    setImageBase64(panel.image_base64 || '');
    setSelectedAssetId(panel.asset_id || '');
    // Default tab: if panel already has an attached asset, open asset tab
    setImageTab(panel.asset_id ? 'asset' : 'draw');
    setShowModal(true);

    setTimeout(() => {
      if (!panel.asset_id) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (panel.image_base64) {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0); };
          img.src = panel.image_base64;
        } else {
          clearCanvas();
        }
      }
    }, 100);
  };

  // ─── Panel CRUD ─────────────────────────────────────────────────────────────
  const handleDelete = async (panelId: string) => {
    if (!confirm('Delete this storyboard panel?')) return;
    try {
      if (inDbMode) {
        await dbDeleteStoryboardPanel(panelId);
      } else {
        deleteStoryboardPanel(selectedSceneId, panelId);
      }
      setPanels(prev => prev.filter(p => p.id !== panelId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSceneId) return;

    // In DB mode, if the user is on the asset tab, store selected asset_id (not base64).
    const useAsset = inDbMode && imageTab === 'asset' && selectedAssetId;

    const panel: StoryboardPanel = {
      id: editingPanel ? editingPanel.id : crypto.randomUUID(),
      scene_id: selectedSceneId,
      panel_number: Number(panelNumber),
      visual_prompt: visualPrompt.trim(),
      action_description: actionDescription.trim(),
      dialogue: dialogue.trim() || undefined,
      camera_shot: cameraShot,
      // Only persist base64 if NOT using an asset library image
      image_base64: useAsset ? undefined : (imageBase64 || undefined),
      asset_id: useAsset ? selectedAssetId : undefined,
      created_at: editingPanel?.created_at,
    };

    try {
      if (inDbMode) {
        await dbSaveStoryboardPanel(selectedSceneId, panel);
        setPanels(await dbGetStoryboardPanels(selectedSceneId));
      } else {
        saveStoryboardPanel(panel);
        setPanels(getStoryboardPanels(selectedSceneId));
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Quick-clear asset from an existing panel (from the card, without opening the modal)
  const handleClearPanelAsset = async (panel: StoryboardPanel) => {
    if (!confirm('Remove the attached asset from this panel?')) return;
    try {
      setAttachingPanelId(panel.id);
      await dbClearStoryboardPanelAsset(panel.id);
      // Refresh panels list
      setPanels(await dbGetStoryboardPanels(selectedSceneId));
    } catch (err) {
      console.error(err);
    } finally {
      setAttachingPanelId('');
    }
  };

  if (loading) {
    return (
      <Navigation>
        <div className="flex items-center justify-center h-64">
          <Spinner text="Loading storyboard..." />
        </div>
      </Navigation>
    );
  }

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  return (
    <Navigation>
      <Header
        title="Storyboard Studio"
        subtitle={`Visual narrative builder for project: ${projectName}`}
        actions={
          scenes.length > 0 && selectedSceneId ? (
            <Button variant="gold" size="sm" onClick={handleOpenAdd}>
              + Add Panel
            </Button>
          ) : null
        }
      />

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {scenes.length === 0 ? (
          <div className="text-center py-20 bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg">
            <div className="text-5xl mb-4">🎬</div>
            <h3 className="text-xl font-bold text-white mb-2">No Scenes Available</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              You must create at least one Scene in this project before you can build a storyboard.
            </p>
            <Button variant="gold" onClick={() => router.push(`/universe/${id}/scenes`)}>
              Go to Scenes
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Scene Selector */}
            <div className="lg:col-span-1 bg-[#0a0a0f] border border-[#c9a84c]/20 rounded-lg p-4 h-fit max-h-[calc(100vh-200px)] overflow-y-auto">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c]/70 mb-3 px-1">
                Select Scene Beat
              </h3>
              <div className="space-y-1">
                {scenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => handleSelectScene(scene.id)}
                    className={`w-full text-left px-3 py-2.5 rounded text-sm transition-all duration-150 border flex items-start gap-2.5 ${
                      selectedSceneId === scene.id
                        ? 'bg-[#c9a84c]/15 text-[#c9a84c] border-[#c9a84c]/30 font-semibold'
                        : 'text-gray-400 hover:text-white border-transparent hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[#c9a84c] font-black">#{scene.order}</span>
                    <span className="truncate flex-1">{scene.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Storyboard Grid */}
            <div className="lg:col-span-3 space-y-6">
              {selectedScene && (
                <div className="border-b border-[#c9a84c]/10 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/20 px-2 py-0.5 rounded">
                      Scene #{selectedScene.order}
                    </span>
                    <h2 className="text-xl font-bold text-white">{selectedScene.title}</h2>
                  </div>
                  {selectedScene.summary && (
                    <p className="text-gray-400 text-sm mt-1 whitespace-pre-line">{selectedScene.summary}</p>
                  )}
                </div>
              )}

              {panels.length === 0 ? (
                <div className="text-center py-20 bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg">
                  <div className="text-5xl mb-4">🖼️</div>
                  <h3 className="text-lg font-bold text-white mb-1">Empty Storyboard Scene</h3>
                  <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                    No storyboard panels have been mapped to this scene beat yet.
                  </p>
                  <Button variant="gold" size="sm" onClick={handleOpenAdd}>
                    + Add First Panel
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {panels.map((panel) => (
                    <Card
                      key={panel.id}
                      className="border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-all flex flex-col justify-between overflow-hidden bg-[#0c0c14]"
                    >
                      <div>
                        {/* Panel Header */}
                        <div className="flex items-center justify-between bg-[#13131f] px-4 py-2 border-b border-[#c9a84c]/10">
                          <span className="text-[#c9a84c] font-black text-sm">
                            PANEL {panel.panel_number}
                          </span>
                          <div className="flex items-center gap-2">
                            {panel.asset_id && (
                              <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
                                📎 Asset
                              </span>
                            )}
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                              {panel.camera_shot}
                            </span>
                          </div>
                        </div>

                        {/* Panel Image Frame */}
                        <div className="aspect-[4/3] w-full bg-[#030305] relative border-b border-[#c9a84c]/10 flex items-center justify-center overflow-hidden">
                          {panel.asset_id ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={`/api/db/assets/${panel.asset_id}/serve`}
                              alt={`Panel ${panel.panel_number} asset`}
                              className="w-full h-full object-cover"
                            />
                          ) : panel.image_base64 ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={panel.image_base64}
                              alt={`Panel ${panel.panel_number} sketch`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-gray-700 select-none p-4">
                              <span className="text-3xl block mb-1">📐</span>
                              <span className="text-xs uppercase tracking-wider font-mono">No sketch drawn</span>
                            </div>
                          )}
                        </div>

                        {/* Panel Details */}
                        <div className="p-4 space-y-3">
                          {panel.visual_prompt && (
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-[#c9a84c]/60 block font-bold mb-0.5">
                                Visual Description
                              </span>
                              <p className="text-xs text-white leading-relaxed">{panel.visual_prompt}</p>
                            </div>
                          )}
                          {panel.action_description && (
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-gray-500 block font-bold mb-0.5">
                                Action Directions
                              </span>
                              <p className="text-xs text-gray-400 leading-relaxed">{panel.action_description}</p>
                            </div>
                          )}
                          {panel.dialogue && (
                            <div className="bg-black/30 border-l-2 border-[#c9a84c] p-2 rounded-r">
                              <span className="text-[8px] uppercase tracking-widest text-[#c9a84c]/80 block font-bold mb-0.5">
                                Dialogue
                              </span>
                              <p className="text-xs text-[#c9a84c] italic font-mono">&quot;{panel.dialogue}&quot;</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Panel Footer Controls */}
                      <div className="p-4 pt-0 flex justify-end gap-2">
                        {inDbMode && panel.asset_id && (
                          <button
                            onClick={() => handleClearPanelAsset(panel)}
                            disabled={attachingPanelId === panel.id}
                            className="text-gray-500 hover:text-orange-400 transition-colors px-2 py-1 text-xs font-mono border border-transparent hover:border-orange-400/20 rounded"
                            title="Remove attached asset"
                          >
                            {attachingPanelId === panel.id ? '…' : '✕ Clear Asset'}
                          </button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(panel)}>
                          ✏️ Edit
                        </Button>
                        <button
                          onClick={() => handleDelete(panel.id)}
                          className="text-gray-600 hover:text-[#c41e3a] transition-colors p-1"
                          title="Delete Panel"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Panel Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingPanel ? `Edit Panel ${panelNumber}` : 'Add Storyboard Panel'}
        size="xl"
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column — text fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                  Panel Number
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={panelNumber}
                  onChange={(e) => setPanelNumber(Number(e.target.value))}
                  className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                  Camera Shot Type
                </label>
                <select
                  value={cameraShot}
                  onChange={(e) => setCameraShot(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
                >
                  {CAMERA_SHOT_OPTIONS.map((shot) => (
                    <option key={shot} value={shot}>{shot}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                Visual Prompt / Scene Sketch Details
              </label>
              <textarea
                rows={3}
                required
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                placeholder="Detail what is visually shown inside the frame…"
                className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                Action &amp; Camera Directions
              </label>
              <textarea
                rows={2}
                required
                value={actionDescription}
                onChange={(e) => setActionDescription(e.target.value)}
                placeholder="What action happens? (e.g. He raises the key, camera pans down to lock)…"
                className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                Dialogue (Optional)
              </label>
              <input
                type="text"
                value={dialogue}
                onChange={(e) => setDialogue(e.target.value)}
                placeholder="Character lines or narration text…"
                className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#c9a84c]/10">
              <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="gold" type="submit">
                {editingPanel ? 'Save Changes' : 'Create Panel'}
              </Button>
            </div>
          </div>

          {/* Right column — image: Draw or Asset Library */}
          <div className="flex flex-col gap-3">
            {/* Tab switcher (DB mode only) */}
            {inDbMode && (
              <div className="flex items-center gap-1 bg-black/40 rounded p-1 border border-white/5 self-start">
                <button
                  type="button"
                  onClick={() => setImageTab('draw')}
                  className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                    imageTab === 'draw'
                      ? 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  ✏️ Draw
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('asset')}
                  className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                    imageTab === 'asset'
                      ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  📎 Asset Library
                </button>
              </div>
            )}

            {/* Draw tab */}
            {(!inDbMode || imageTab === 'draw') && (
              <>
                <span className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70">
                  Storyboard Sketch Drawing Pad
                </span>
                <div className="relative border border-[#c9a84c]/20 rounded overflow-hidden aspect-[4/3] w-full bg-[#0f0f16]">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={300}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full h-full cursor-crosshair block touch-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3 rounded border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 uppercase font-mono">Color:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { color: '#c9a84c', label: 'Gold' },
                          { color: '#3b82f6', label: 'Blue' },
                          { color: '#ffffff', label: 'White' },
                          { color: '#ef4444', label: 'Red' },
                        ].map((colorObj) => (
                          <button
                            key={colorObj.color}
                            type="button"
                            onClick={() => setBrushColor(colorObj.color)}
                            className={`w-5 h-5 rounded-full border transition-all ${
                              brushColor === colorObj.color ? 'border-white scale-110' : 'border-transparent scale-90'
                            }`}
                            style={{ backgroundColor: colorObj.color }}
                            title={colorObj.label}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 uppercase font-mono">Size:</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-16 accent-[#c9a84c] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] text-white font-mono">{brushSize}px</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={generateMockSketch}
                      className="px-2.5 py-1 rounded text-xs bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/20 font-mono transition-colors"
                    >
                      ⚡ Mock AI Sketch
                    </button>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="px-2.5 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 font-mono transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Asset Library tab (DB mode only) */}
            {inDbMode && imageTab === 'asset' && (
              <div className="flex flex-col gap-3">
                <span className="block text-xs font-medium uppercase tracking-widest text-emerald-400/70">
                  Choose from Asset Library
                </span>
                {projectAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center aspect-[4/3] border border-dashed border-emerald-400/20 rounded bg-black/20 text-center gap-2">
                    <span className="text-2xl">📭</span>
                    <p className="text-xs text-gray-500 max-w-[200px]">
                      No assets uploaded yet. Go to the Project Detail page to upload images.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                      {projectAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => setSelectedAssetId(asset.id)}
                          className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                            selectedAssetId === asset.id
                              ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                              : 'border-transparent hover:border-white/20'
                          }`}
                          title={asset.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/db/assets/${asset.id}/serve`}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                          {selectedAssetId === asset.id && (
                            <div className="absolute inset-0 bg-emerald-400/20 flex items-center justify-center">
                              <span className="text-emerald-400 text-xl font-black">✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedAssetId && (
                      <div className="flex items-center justify-between bg-emerald-400/5 border border-emerald-400/20 rounded p-2">
                        <span className="text-xs text-emerald-400 font-mono truncate">
                          ✓ {projectAssets.find(a => a.id === selectedAssetId)?.name || 'Asset selected'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAssetId('')}
                          className="text-gray-500 hover:text-red-400 text-xs ml-2 shrink-0"
                        >
                          ✕ Clear
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </Navigation>
  );
}
