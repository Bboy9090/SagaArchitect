'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Spinner } from '@/components/ui/Spinner';
import { getUniverseById } from '@/lib/storage';
import { isDbMode } from '@/lib/storage-mode';
import { dbGetProject } from '@/lib/db-client';
import { PHOENIX_STUDIOS, STUDIO_STATUS_LABELS, type StudioCapabilityStatus } from '@/lib/studio-capabilities';
import type { Universe } from '@/lib/types';

interface StudioHubPageProps {
  params: Promise<{ id: string }>;
}

const statusClasses: Record<StudioCapabilityStatus, string> = {
  live: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  foundation: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  planned: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

export default function StudioHubPage({ params }: StudioHubPageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Universe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = isDbMode() ? await dbGetProject(id) : getUniverseById(id) || null;
        if (!cancelled) setProject(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <Navigation>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner text="Opening Phoenix Studio..." />
        </div>
      </Navigation>
    );
  }

  if (!project) {
    return (
      <Navigation>
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-2xl font-black text-white">Production not found</h1>
          <Link href="/dashboard" className="mt-5 inline-flex text-sm font-bold text-blue-300 hover:text-blue-200">
            Return to Studio Home
          </Link>
        </div>
      </Navigation>
    );
  }

  const liveCount = PHOENIX_STUDIOS.filter(studio => studio.status === 'live').length;
  const foundationCount = PHOENIX_STUDIOS.filter(studio => studio.status === 'foundation').length;

  return (
    <Navigation>
      <Header
        title="Phoenix Studio Hub"
        subtitle={`Unified production floor for ${project.name}`}
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8 overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#07152e] via-[#0d1025] to-[#1a0d30] p-6 md:p-8">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.35em] text-blue-300/70">
            Creative production operating system
          </p>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-4xl text-3xl font-black tracking-[-.03em] text-white md:text-5xl">
                One canon. Every production surface.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Writing, storyboards, images, illustration, comics, video, motion, audio, assets, world canon,
                and publishing share the same Phoenix project instead of becoming disconnected files.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-emerald-400/20 bg-black/20 px-5 py-4">
                <div className="text-2xl font-black text-emerald-300">{liveCount}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Live studios</div>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-black/20 px-5 py-4">
                <div className="text-2xl font-black text-amber-300">{foundationCount}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">In foundation</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PHOENIX_STUDIOS.map(studio => {
            const href = studio.route?.(id);
            const card = (
              <article
                className={`group h-full rounded-2xl border p-5 transition-all ${href
                  ? 'border-white/10 bg-[#0a1020] hover:-translate-y-0.5 hover:border-blue-300/30 hover:bg-[#0d1529]'
                  : 'border-white/5 bg-[#080b13]'}`}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/5 text-xl text-blue-200">
                    {studio.icon}
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClasses[studio.status]}`}>
                    {STUDIO_STATUS_LABELS[studio.status]}
                  </span>
                </div>

                <h2 className="text-xl font-black text-white">{studio.label}</h2>
                <p className="mt-2 min-h-12 text-sm leading-5 text-slate-400">{studio.summary}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {studio.capabilities.slice(0, 5).map(capability => (
                    <span
                      key={capability}
                      className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-slate-400"
                    >
                      {capability}
                    </span>
                  ))}
                </div>

                <div className="mt-5 border-t border-white/5 pt-4">
                  {href ? (
                    <span className="text-xs font-black uppercase tracking-wider text-blue-300 group-hover:text-blue-200">
                      Open {studio.label} →
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-600">
                      Editor engine scheduled for the next production phases
                    </span>
                  )}
                </div>
              </article>
            );

            return href ? (
              <Link key={studio.id} href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                {card}
              </Link>
            ) : (
              <div key={studio.id}>{card}</div>
            );
          })}
        </div>

        <section className="mt-8 rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] p-6">
          <h2 className="text-lg font-black text-white">Phoenix production rule</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            New editors must consume the existing project canon, asset library, version history, and export pipeline.
            A video, illustration, comic panel, cover, or audio production is a child of this project—not an unrelated file.
            This is the continuity layer that distinguishes Phoenix Creator Studio from a collection of separate tools.
          </p>
        </section>
      </div>
    </Navigation>
  );
}
