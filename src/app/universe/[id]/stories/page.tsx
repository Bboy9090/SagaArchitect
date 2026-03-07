'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import {
  getUniverseById, getFactions, getCharacters, getLocations,
  getTimeline, getArcs, getLoreRules,
  getStories, saveStory, deleteStory,
} from '@/lib/storage';
import { buildCanonBlock, getCanonBlockStats } from '@/lib/lore-engine';
import type { Universe, GeneratedStory, StoryFormat, MediaProjectType } from '@/lib/types';

interface StoriesPageProps {
  params: Promise<{ id: string }>;
}

const FORMAT_OPTIONS: { format: StoryFormat; label: string; icon: string; desc: string }[] = [
  { format: 'opening_chapter', label: 'Opening Chapter', icon: '📖', desc: 'The first chapter of a novel. Hook, world, protagonist, central tension.' },
  { format: 'short_story', label: 'Short Story', icon: '📝', desc: 'A complete short story with beginning, middle, and end.' },
  { format: 'scene', label: 'Scene', icon: '🎬', desc: 'A single powerful scene — a moment of tension, revelation, or turning point.' },
  { format: 'book_outline', label: 'Book Outline', icon: '🗂️', desc: 'A full novel outline with chapter-by-chapter structure and arc breakdown.' },
  { format: 'children_book', label: "Children's Book", icon: '🌟', desc: 'A complete illustrated children\'s book. Simple, vivid, and emotionally resonant.' },
];

const PROJECT_TYPE_LABELS: Record<MediaProjectType, { icon: string; label: string }> = {
  book: { icon: '📚', label: 'Novel' },
  children_book: { icon: '🌟', label: "Children's Book" },
  game: { icon: '🎮', label: 'Game' },
  comic: { icon: '💬', label: 'Comic' },
  film: { icon: '🎬', label: 'Film / Script' },
  short_story: { icon: '📝', label: 'Short Story' },
  script: { icon: '🎭', label: 'Script' },
};

const RICHNESS_LABELS = {
  empty: { label: 'No canon loaded', color: 'text-gray-500' },
  sparse: { label: 'Sparse canon', color: 'text-yellow-600' },
  moderate: { label: 'Moderate canon', color: 'text-yellow-400' },
  rich: { label: 'Rich canon', color: 'text-green-400' },
  complete: { label: 'Complete canon', color: 'text-[#c9a84c]' },
};

export default function StoriesPage({ params }: StoriesPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat>('opening_chapter');
  const [focusPrompt, setFocusPrompt] = useState('');
  const [activeStory, setActiveStory] = useState<GeneratedStory | null>(null);
  const [canonRichness, setCanonRichness] = useState<ReturnType<typeof getCanonBlockStats> | null>(null);

  useEffect(() => {
    void (async () => {
      const u = getUniverseById(id);
      if (!u) { router.push('/dashboard'); return; }
      setUniverse(u);
      setStories(getStories(id));

      const block = buildCanonBlock({
        universe: u,
        factions: getFactions(id),
        characters: getCharacters(id),
        locations: getLocations(id),
        timeline: getTimeline(id),
        lore_rules: getLoreRules(id),
        story_arcs: getArcs(id),
      });
      setCanonRichness(getCanonBlockStats(block));
      setLoading(false);
    })();
  }, [id, router]);

  const handleGenerate = async () => {
    if (!universe) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe,
          factions: getFactions(id),
          characters: getCharacters(id),
          locations: getLocations(id),
          timeline: getTimeline(id),
          lore_rules: getLoreRules(id),
          story_arcs: getArcs(id),
          format: selectedFormat,
          focusPrompt: focusPrompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.story) {
        const story: GeneratedStory = {
          id: crypto.randomUUID(),
          universe_id: id,
          title: data.story.title ?? 'Untitled Story',
          format: selectedFormat,
          content: data.story.content ?? '',
          featured_characters: data.story.featured_characters ?? [],
          featured_factions: data.story.featured_factions ?? [],
          featured_locations: data.story.featured_locations ?? [],
          created_at: new Date().toISOString(),
        };
        saveStory(story);
        setStories(prev => [story, ...prev]);
        setActiveStory(story);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = (storyId: string) => {
    if (!confirm('Delete this story?')) return;
    deleteStory(id, storyId);
    setStories(prev => prev.filter(s => s.id !== storyId));
    if (activeStory?.id === storyId) setActiveStory(null);
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading story forge..." />
      </div>
    </Navigation>
  );

  if (!universe) return null;

  return (
    <Navigation>
      <Header
        title="Story Forge"
        subtitle={`Generate stories from the ${universe.name} canon — powered by LoreEngine`}
        actions={
          <div className="flex items-center gap-2">
            {canonRichness && (
              <span className={`text-xs font-medium ${RICHNESS_LABELS[canonRichness.richness].color}`}>
                ◆ {RICHNESS_LABELS[canonRichness.richness].label}
              </span>
            )}
          </div>
        }
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* LoreEngine badge */}
        <div className="mb-6 flex items-start gap-4 bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-4">
          <div className="text-2xl">⚡</div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-[#c9a84c]">Powered by LoreEngine</span>
              <span className="text-[10px] text-gray-600 uppercase tracking-widest bg-[#c9a84c]/10 px-2 py-0.5 rounded">
                Canon-aware
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Every story generated here is injected with the full canon context of {universe.name} —
              factions, characters, locations, timeline, and world rules.
              Stories stay consistent with your lore. This is the same engine Rainstorms uses.
            </p>
            {canonRichness && (
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                <span>{canonRichness.factions} factions</span>
                <span>{canonRichness.characters} characters</span>
                <span>{canonRichness.locations} locations</span>
                <span>{canonRichness.timeline_events} events</span>
                <span>{canonRichness.lore_rules} rules</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: generator controls */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Choose Format</h2>

            {FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.format}
                onClick={() => setSelectedFormat(opt.format)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedFormat === opt.format
                    ? 'border-[#c9a84c] bg-[#c9a84c]/10'
                    : 'border-[#c9a84c]/20 bg-[#0f0f1a] hover:border-[#c9a84c]/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{opt.icon}</span>
                  <span className={`text-sm font-semibold ${selectedFormat === opt.format ? 'text-[#c9a84c]' : 'text-white'}`}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </button>
            ))}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Focus (optional)
              </label>
              <textarea
                value={focusPrompt}
                onChange={e => setFocusPrompt(e.target.value)}
                placeholder={`e.g. "Focus on Kael's first encounter with the Iron Empire" or "Set in the Ember Citadel"`}
                rows={3}
                className="w-full bg-[#0a0a0f] border border-[#c9a84c]/30 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] placeholder-gray-700 resize-none"
              />
            </div>

            <Button
              variant="gold"
              size="lg"
              className="w-full"
              loading={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Generating...' : '✨ Generate Story'}
            </Button>

            {/* Supported project types */}
            <div className="pt-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Supported media types</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PROJECT_TYPE_LABELS).map(([type, meta]) => (
                  <span key={type} className="text-xs text-gray-500 bg-white/5 rounded px-2 py-0.5">
                    {meta.icon} {meta.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: story viewer */}
          <div className="lg:col-span-2">
            {activeStory ? (
              <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg overflow-hidden">
                <div className="flex items-start justify-between p-4 border-b border-[#c9a84c]/10">
                  <div>
                    <h3 className="font-bold text-white">{activeStory.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-[#c9a84c]/10 text-[#c9a84c] rounded px-2 py-0.5">
                        {FORMAT_OPTIONS.find(f => f.format === activeStory.format)?.label}
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(activeStory.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {activeStory.featured_characters.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Characters: {activeStory.featured_characters.join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(activeStory.id)}
                  >
                    🗑
                  </Button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                    {activeStory.content}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-lg">
                <div className="text-4xl mb-3">📖</div>
                <p className="text-gray-500 text-sm">
                  Choose a format and click Generate Story.<br />
                  Your universe canon will be woven into every word.
                </p>
              </div>
            )}

            {/* Story history */}
            {stories.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Generated Stories ({stories.length})
                </h3>
                <div className="space-y-2">
                  {stories.map(story => (
                    <Card key={story.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setActiveStory(story)}
                          className="text-left flex-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {FORMAT_OPTIONS.find(f => f.format === story.format)?.icon}
                            </span>
                            <span className={`text-sm font-medium ${activeStory?.id === story.id ? 'text-[#c9a84c]' : 'text-white'}`}>
                              {story.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-600">
                              {FORMAT_OPTIONS.find(f => f.format === story.format)?.label}
                            </span>
                            <span className="text-xs text-gray-700">
                              {new Date(story.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                        <button
                          onClick={() => handleDelete(story.id)}
                          className="text-gray-700 hover:text-red-400 text-xs ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Navigation>
  );
}
