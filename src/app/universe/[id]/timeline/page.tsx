'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { TimelineEventItem } from '@/components/timeline/TimelineEvent';
import { TimelineForm } from '@/components/timeline/TimelineForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getTimeline, saveTimelineEvent, deleteTimelineEvent, saveTimelineEvents, getUniverseById } from '@/lib/storage';
import type { TimelineEvent } from '@/lib/types';

interface TimelinePageProps {
  params: Promise<{ id: string }>;
}

export default function TimelinePage({ params }: TimelinePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const u = getUniverseById(id);
    if (!u) { router.push('/dashboard'); return; }
    setEvents(getTimeline(id));
    setLoading(false);
  }, [id, router]);

  const handleDelete = (eventId: string) => {
    deleteTimelineEvent(id, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const handleSave = (data: Omit<TimelineEvent, 'id'>) => {
    const event: TimelineEvent = { ...data, id: crypto.randomUUID() };
    saveTimelineEvent(event);
    setEvents(prev => [...prev, event]);
    setShowForm(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const universe = getUniverseById(id);
      const res = await fetch('/api/generate/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe }),
      });
      const data = await res.json();
      if (data.events) {
        const newEvents: TimelineEvent[] = data.events.map((e: Omit<TimelineEvent, 'id' | 'universe_id'>) => ({
          ...e,
          id: crypto.randomUUID(),
          universe_id: id,
        }));
        saveTimelineEvents(id, newEvents);
        setEvents(newEvents);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <Navigation>
      <div className="flex items-center justify-center h-64">
        <Spinner text="Loading timeline..." />
      </div>
    </Navigation>
  );

  return (
    <Navigation>
      <Header
        title="Timeline Engine"
        subtitle={`${events.length} historical event${events.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" loading={generating} onClick={handleGenerate}>
              ✨ Generate Timeline
            </Button>
            <Button variant="gold" size="sm" onClick={() => setShowForm(true)}>
              + Add Event
            </Button>
          </div>
        }
      />

      <div className="px-6 py-6 max-w-3xl">
        {events.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⏳</div>
            <h3 className="text-xl font-bold text-white mb-2">No Timeline Events Yet</h3>
            <p className="text-gray-500 mb-6">History is written by those who survive. Start writing yours.</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="gold" onClick={() => setShowForm(true)}>+ Add Event</Button>
              <Button variant="secondary" loading={generating} onClick={handleGenerate}>✨ Generate with AI</Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            {events.map((event, idx) => (
              <TimelineEventItem
                key={event.id}
                event={event}
                index={idx}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Timeline Event" size="lg">
        <TimelineForm
          universeId={id}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </Navigation>
  );
}
