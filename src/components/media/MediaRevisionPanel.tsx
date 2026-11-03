'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  dbCreateMediaDocumentSnapshot,
  dbGetMediaDocumentHistory,
  dbRestoreMediaDocument,
  type MediaDocumentRevisionSummary,
} from '@/lib/db-client';
import type { PhoenixMediaDocument, PhoenixMediaDocumentKind } from '@/lib/media-composition';

interface MediaRevisionPanelProps {
  projectId: string;
  kind: PhoenixMediaDocumentKind;
  currentVersion: number;
  enabled: boolean;
  onRestore: (document: PhoenixMediaDocument) => void;
  onError?: (message: string) => void;
}

export function MediaRevisionPanel({
  projectId,
  kind,
  currentVersion,
  enabled,
  onRestore,
  onError,
}: MediaRevisionPanelProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MediaDocumentRevisionSummary[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    if (!enabled) return;
    try {
      setRows(await dbGetMediaDocumentHistory(projectId, kind));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load revision history.';
      setStatus(message);
      onError?.(message);
    }
  };

  if (!enabled) {
    return (
      <Button size="sm" variant="ghost" disabled title="Revision history requires Studio Cloud mode.">
        Versions
      </Button>
    );
  }

  const createSnapshot = async () => {
    setBusy('snapshot');
    setStatus('');
    try {
      await dbCreateMediaDocumentSnapshot(projectId, kind, label);
      setLabel('');
      setStatus('Snapshot saved.');
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Snapshot failed.';
      setStatus(message);
      onError?.(message);
    } finally {
      setBusy('');
    }
  };

  const restore = async (row: MediaDocumentRevisionSummary) => {
    setBusy(row.id);
    setStatus('');
    try {
      const restored = await dbRestoreMediaDocument(projectId, kind, row.id, currentVersion);
      onRestore(restored);
      setStatus(`Restored version ${row.version}. A pre-restore backup was created.`);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed.';
      setStatus(message);
      onError?.(message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void load();
        }}
      >
        Versions
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-[12000] w-[340px] rounded-xl border border-white/10 bg-[#070b15] p-3 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-white">Cloud Recovery</div>
              <div className="text-[10px] text-slate-500">Automatic checkpoints + manual snapshots</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>×</Button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={label}
              maxLength={120}
              onChange={event => setLabel(event.target.value)}
              placeholder="Snapshot label"
              className="min-h-9 min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-2 text-xs text-white"
            />
            <Button size="sm" variant="secondary" loading={busy === 'snapshot'} onClick={() => void createSnapshot()}>
              Save
            </Button>
          </div>

          {status && <div className="mt-2 text-[10px] leading-4 text-slate-400">{status}</div>}

          <div className="mt-3 max-h-80 space-y-2 overflow-auto">
            {rows.map(row => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold text-white">{row.label || 'Checkpoint'}</div>
                    <div className="text-[9px] text-slate-500">
                      v{row.version} · {new Date(row.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" loading={busy === row.id} onClick={() => void restore(row)}>
                    Restore
                  </Button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-[11px] text-slate-600">
                No cloud checkpoints yet. Phoenix will create one automatically during continued editing, or save one now.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
