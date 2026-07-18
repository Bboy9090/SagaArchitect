'use client';

import { useState, useEffect, use } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Spinner } from '@/components/ui/Spinner';
import { isDbMode } from '@/lib/storage-mode';

interface HistoryEntry {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  change_data: Record<string, unknown>;
  created_at: string;
}

interface HistoryPageProps {
  params: Promise<{ id: string }>;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/20 text-green-400 border-green-500/30',
  update: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ACTION_ICONS: Record<string, string> = {
  create: '+',
  update: '~',
  delete: '×',
};

const ENTITY_ICONS: Record<string, string> = {
  project: '🌍',
  character: '👤',
  scene: '🎬',
  storyboard_panel: '🖼️',
  asset: '📎',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEntityLabel(entry: HistoryEntry): string {
  const data = entry.change_data;
  return (data.name as string) || (data.title as string) || entry.entity_id.slice(0, 8);
}

export default function HistoryPage({ params }: HistoryPageProps) {
  const { id } = use(params);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(() => isDbMode());
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (!isDbMode()) {
      return;
    }
    fetch(`/api/db/projects/${id}/history`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setEntries(json.data);
        else setError(json.error || 'Failed to load history');
      })
      .catch(() => setError('Failed to fetch history'))
      .finally(() => setLoading(false));
  }, [id]);

  const entityTypes = ['all', ...Array.from(new Set(entries.map((e) => e.entity_type)))];
  const filtered = filterType === 'all' ? entries : entries.filter((e) => e.entity_type === filterType);

  if (!isDbMode()) {
    return (
      <Navigation>
        <Header title="Version History" subtitle="Database mode required" />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Version history is only available in database mode.</p>
        </div>
      </Navigation>
    );
  }

  return (
    <Navigation>
      <Header title="Version History" subtitle="Read-only audit log of all changes" />
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner text="Loading history..." />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No history yet</p>
            <p className="text-gray-600 text-sm mt-1">Changes to this project will appear here.</p>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {entityTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`
                    px-3 py-1.5 rounded text-xs font-medium border transition-all
                    ${filterType === type
                      ? 'bg-[#c9a84c]/20 text-[#c9a84c] border-[#c9a84c]/40'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'}
                  `}
                >
                  {ENTITY_ICONS[type] || ''} {type === 'all' ? 'All' : type}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-600 self-center">
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-[#c9a84c]/10" />
              <div className="space-y-1">
                {filtered.map((entry) => (
                  <div key={entry.id} className="relative flex items-start gap-4 py-3 pl-10">
                    {/* Timeline dot */}
                    <div className={`
                      absolute left-3 top-4 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold
                      ${ACTION_COLORS[entry.action] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                    `}>
                      {ACTION_ICONS[entry.action] || '?'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`
                          px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border
                          ${ACTION_COLORS[entry.action] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                        `}>
                          {entry.action}
                        </span>
                        <span className="text-gray-300 text-sm font-medium">
                          {ENTITY_ICONS[entry.entity_type] || '📄'} {entry.entity_type}
                        </span>
                        <span className="text-white text-sm font-semibold truncate">
                          {getEntityLabel(entry)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-1">
                        {formatDate(entry.created_at)}
                      </p>

                      {/* Change data preview */}
                      {entry.action !== 'delete' && (
                        <details className="mt-2 group">
                          <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                            View change data
                          </summary>
                          <pre className="mt-1 p-3 bg-black/40 rounded border border-white/5 text-[11px] text-gray-400 overflow-x-auto max-h-48">
                            {JSON.stringify(entry.change_data, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Restore Action */}
                      <button
                        onClick={async () => {
                          if (!confirm(`Restore this state for ${entry.entity_type}?`)) return;
                          try {
                            const res = await fetch(`/api/db/projects/${id}/history/restore`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ historyId: entry.id }),
                            });
                            const data = await res.json();
                            if (data.ok) {
                              alert('Reverted successfully!');
                              window.location.reload();
                            } else {
                              alert(data.error || 'Restore failed.');
                            }
                          } catch {
                            alert('A network error occurred.');
                          }
                        }}
                        className="mt-2 text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-1 rounded hover:bg-[#c9a84c]/20 hover:text-[#c9a84c] transition-colors"
                      >
                        ↩️ Restore State
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Navigation>
  );
}
