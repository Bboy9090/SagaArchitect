'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  getArcs,
  getCharacters,
  getFactions,
  getLocations,
  getLoreRules,
  getTimeline,
  getUniverseById,
} from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetCharacters, dbGetProject } from '@/lib/db-client';
import {
  DIRECTOR_STUDIO_ROUTES,
  normalizeDirectorPlan,
  type PhoenixDirectorPlan,
  type PhoenixDirectorStudio,
} from '@/lib/phoenix-director';
import type { Universe } from '@/lib/types';

interface DirectorPageProps {
  params: Promise<{ id: string }>;
}

const STUDIO_OPTIONS: Array<{ id: PhoenixDirectorStudio; label: string }> = [
  { id: 'write', label: 'Writing' },
  { id: 'book', label: 'Book' },
  { id: 'design', label: 'Design' },
  { id: 'image', label: 'Image' },
  { id: 'illustrate', label: 'Illustration' },
  { id: 'comic', label: 'Comic' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'video', label: 'Video' },
  { id: 'motion', label: 'Motion' },
  { id: 'audio', label: 'Audio' },
  { id: 'publish', label: 'Publish' },
];

const PRIORITY_CLASS = {
  critical: 'border-red-400/30 bg-red-400/10 text-red-300',
  high: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  medium: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  low: 'border-slate-400/20 bg-slate-400/5 text-slate-400',
} as const;

export default function DirectorPage({ params }: DirectorPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [selectedStudios, setSelectedStudios] = useState<PhoenixDirectorStudio[]>(STUDIO_OPTIONS.map(item => item.id));
  const [plan, setPlan] = useState<PhoenixDirectorPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (!cancelled) setProject(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const canonStats = useMemo(() => ({
    characters: getCharacters(id).length,
    factions: getFactions(id).length,
    locations: getLocations(id).length,
    timeline: getTimeline(id).length,
    lore: getLoreRules(id).length,
    arcs: getArcs(id).length,
  }), [id]);

  const toggleStudio = (studio: PhoenixDirectorStudio) => {
    setSelectedStudios(current => current.includes(studio)
      ? current.filter(item => item !== studio)
      : [...current, studio]);
  };

  const generatePlan = async () => {
    if (!project || !brief.trim() || planning) return;
    setPlanning(true);
    setStatus('');
    setPlan(null);
    try {
      const characters = isDbMode() ? await dbGetCharacters(id) : getCharacters(id);
      const response = await fetch('/api/director/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief.trim(),
          targetStudios: selectedStudios,
          universe: project,
          characters,
          factions: getFactions(id),
          locations: getLocations(id),
          timeline: getTimeline(id),
          lore_rules: getLoreRules(id),
          story_arcs: getArcs(id),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Director planning failed.');
      setPlan(normalizeDirectorPlan(payload.plan));
      setStatus(response.headers.get('x-phoenix-generation-mode') === 'mock'
        ? 'Development-mode plan generated. Production requires the live AI provider.'
        : 'Live canon-aware production plan generated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Director planning failed.');
    } finally {
      setPlanning(false);
    }
  };

  const openStudio = (studio: PhoenixDirectorStudio) => {
    window.location.href = DIRECTOR_STUDIO_ROUTES[studio](id);
  };

  if (loading || !project) {
    return (
      <Navigation>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner text="Opening Phoenix AI Director..." />
        </div>
      </Navigation>
    );
  }

  return (
    <Navigation>
      <Header
        title="Phoenix AI Director"
        subtitle={`Canon-aware production direction for ${project.name}`}
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-2xl border border-blue-400/20 bg-[#081020] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Production brief</p>
              <textarea
                value={brief}
                onChange={event => setBrief(event.target.value)}
                placeholder="Example: Turn chapters 1–3 into a 45-second motion-comic trailer with canonical character designs, dramatic captions, voice-over, SFX, music, a YouTube thumbnail, and final publishing assets."
                className="mt-4 min-h-48 w-full rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white placeholder:text-slate-600"
                maxLength={6000}
              />

              <p className="mt-4 text-[10px] font-black uppercase tracking-[.25em] text-slate-500">Studios in scope</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STUDIO_OPTIONS.map(item => {
                  const active = selectedStudios.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleStudio(item.id)}
                      className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors ${active
                        ? 'border-blue-400/40 bg-blue-400/10 text-blue-200'
                        : 'border-white/10 text-slate-500 hover:border-white/20'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <Button
                className="mt-5 w-full"
                variant="gold"
                loading={planning}
                disabled={!brief.trim() || selectedStudios.length === 0}
                onClick={() => void generatePlan()}
              >
                Generate Production Plan
              </Button>
              {status && <p className="mt-3 text-xs leading-5 text-slate-400">{status}</p>}
            </section>

            <section className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] p-5">
              <div className="text-sm font-black text-white">Canon context</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(canonStats).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/5 bg-black/20 p-2 text-center">
                    <div className="text-lg font-black text-violet-200">{value}</div>
                    <div className="text-[8px] uppercase tracking-wider text-slate-600">{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Director plans receive LoreEngine canon context and must preserve established characters, world rules,
                locations, timeline events, factions, and story arcs.
              </p>
            </section>
          </aside>

          <main>
            {!plan ? (
              <div className="flex min-h-[540px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#050912] p-8 text-center">
                <div className="max-w-xl">
                  <div className="text-5xl">✦</div>
                  <h2 className="mt-4 text-2xl font-black text-white">Direct the entire production</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Give Phoenix an outcome, not individual button instructions. The Director converts that goal into
                    studio-specific actions with dependencies, canon references, risks, and objective completion signals.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-2xl border border-white/10 bg-[#0a1020] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[.3em] text-blue-300/60">Production strategy</p>
                  <h2 className="mt-2 text-xl font-black text-white">{plan.project_summary}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{plan.creative_strategy}</p>
                  {plan.risks.length > 0 && (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {plan.risks.map((risk, index) => (
                        <div key={index} className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-amber-100/80">
                          {risk}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="space-y-3">
                  {plan.actions.map((action, index) => (
                    <article key={action.id} className="rounded-2xl border border-white/10 bg-[#080d17] p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-black text-slate-300">
                            {index + 1}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${PRIORITY_CLASS[action.priority]}`}>
                                {action.priority}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">{action.studio}</span>
                            </div>
                            <h3 className="mt-2 text-lg font-black text-white">{action.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-400">{action.objective}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => openStudio(action.studio)}>
                          Open {action.studio}
                        </Button>
                      </div>

                      {action.instructions.length > 0 && (
                        <ol className="mt-4 space-y-2 border-t border-white/5 pt-4">
                          {action.instructions.map((instruction, step) => (
                            <li key={step} className="flex gap-3 text-xs leading-5 text-slate-400">
                              <span className="font-black text-blue-300">{step + 1}.</span>
                              <span>{instruction}</span>
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {action.canon_refs.length > 0 && (
                          <div className="rounded-lg border border-violet-400/10 bg-violet-400/[0.03] p-3">
                            <div className="text-[9px] font-black uppercase tracking-wider text-violet-300">Canon locks</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {action.canon_refs.map(ref => <span key={ref} className="rounded bg-white/5 px-2 py-1 text-[10px] text-slate-400">{ref}</span>)}
                            </div>
                          </div>
                        )}
                        <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.03] p-3">
                          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Completion signal</div>
                          <p className="mt-2 text-[11px] leading-5 text-slate-400">{action.completion_signal || 'Action deliverable is complete and reviewable.'}</p>
                        </div>
                      </div>

                      {action.depends_on.length > 0 && (
                        <div className="mt-3 text-[10px] text-slate-600">Depends on: {action.depends_on.join(', ')}</div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </Navigation>
  );
}
