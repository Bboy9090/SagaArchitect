'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { CanonBadge } from '@/components/ui/Badge';
import { getScenes, saveScene, deleteScene, getUniverseById } from '@/lib/storage';
import type { Scene, CanonStatus } from '@/lib/types';

// Storage mode helper & client
import { isDbMode } from '@/lib/storage-mode';
import { dbGetScenes, dbSaveScene, dbDeleteScene } from '@/lib/db-client';

interface ScenesPageProps {
  params: Promise<{ id: string }>;
}

export default function ScenesPage({ params }: ScenesPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [order, setOrder] = useState(1);
  const [canonStatus, setCanonStatus] = useState<CanonStatus>('draft');

  const fetchScenes = useCallback(async () => {
    try {
      if (isDbMode()) {
        setScenes(await dbGetScenes(id));
      } else {
        setScenes(getScenes(id));
      }
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const u = getUniverseById(id);
      if (!u) {
        router.push('/dashboard');
        return;
      }
      setProjectName(u.name);
      await fetchScenes();
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [id, router, fetchScenes]);

  const handleOpenAdd = () => {
    setEditingScene(null);
    setTitle('');
    setSummary('');
    setOrder(scenes.length > 0 ? Math.max(...scenes.map(s => s.order)) + 1 : 1);
    setCanonStatus('draft');
    setShowModal(true);
  };

  const handleOpenEdit = (scene: Scene) => {
    setEditingScene(scene);
    setTitle(scene.title);
    setSummary(scene.summary);
    setOrder(scene.order);
    setCanonStatus(scene.canon_status);
    setShowModal(true);
  };

  const handleDelete = async (sceneId: string) => {
    if (!confirm('Delete this scene? Storyboard panels linked to it will remain in memory.')) return;
    try {
      if (isDbMode()) {
        await dbDeleteScene(sceneId);
      } else {
        deleteScene(id, sceneId);
      }
      setScenes(prev => prev.filter(s => s.id !== sceneId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const scene: Scene = {
      id: editingScene ? editingScene.id : crypto.randomUUID(),
      project_id: id,
      title: title.trim(),
      summary: summary.trim(),
      order: Number(order),
      canon_status: canonStatus,
      created_at: editingScene?.created_at,
    };

    try {
      if (isDbMode()) {
        await dbSaveScene(id, scene);
      } else {
        saveScene(scene);
      }
      await fetchScenes();
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <Navigation>
        <div className="flex items-center justify-center h-64">
          <Spinner text="Loading scenes..." />
        </div>
      </Navigation>
    );
  }

  return (
    <Navigation>
      <Header
        title="Scenes"
        subtitle={`Story beats for project: ${projectName}`}
        actions={
          <Button variant="gold" size="sm" onClick={handleOpenAdd}>
            + Add Scene
          </Button>
        }
      />

      <div className="px-6 py-6 max-w-5xl mx-auto">
        {scenes.length === 0 ? (
          <div className="text-center py-20 bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg text-center">
            <div className="text-5xl mb-4">🎬</div>
            <h3 className="text-xl font-bold text-white mb-2">No Scenes Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Break your narrative into key scenes. Storyboards can then be constructed panel-by-panel for each scene.
            </p>
            <Button variant="gold" onClick={handleOpenAdd}>
              + Add Your First Scene
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {scenes.map((scene) => (
              <Card key={scene.id} className="relative group border border-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[#c9a84c] font-black text-lg bg-[#c9a84c]/10 rounded px-2.5 py-0.5 min-w-[40px] text-center border border-[#c9a84c]/20">
                        #{scene.order}
                      </span>
                      <h4 className="text-lg font-bold text-white">{scene.title}</h4>
                      <CanonBadge status={scene.canon_status} />
                    </div>
                    {scene.summary && (
                      <p className="text-gray-400 mt-2 text-sm leading-relaxed whitespace-pre-line">{scene.summary}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 md:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/universe/${id}/storyboard?sceneId=${scene.id}`)}
                    >
                      🖼️ Storyboard
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(scene)}
                    >
                      ✏️ Edit
                    </Button>
                    <button
                      onClick={() => handleDelete(scene.id)}
                      className="text-gray-600 hover:text-[#c41e3a] transition-colors p-1"
                      title="Delete Scene"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingScene ? 'Edit Scene' : 'Add Scene'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
              Scene Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Incident at the Gateway"
              className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                Order / Position
              </label>
              <input
                type="number"
                required
                min="1"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
                Canon Status
              </label>
              <select
                value={canonStatus}
                onChange={(e) => setCanonStatus(e.target.value as CanonStatus)}
                className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="draft">Draft</option>
                <option value="canon">Canon</option>
                <option value="alternate">Alternate</option>
                <option value="deprecated">Deprecated</option>
                <option value="mystery">Mystery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-[#c9a84c]/70 mb-1">
              Scene Summary
            </label>
            <textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What happens in this scene? Detail the primary action and key character movements."
              className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="gold" type="submit">
              {editingScene ? 'Save Changes' : 'Create Scene'}
            </Button>
          </div>
        </form>
      </Modal>
    </Navigation>
  );
}
