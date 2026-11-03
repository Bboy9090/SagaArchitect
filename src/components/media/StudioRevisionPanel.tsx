'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  dbCreateStudioDocumentSnapshot,
  dbGetStudioDocumentHistory,
  dbRestoreStudioDocument,
  type StudioDocumentRevisionSummary,
} from '@/lib/db-client';
import type { PhoenixStudioDocument, PhoenixStudioDocumentKind } from '@/lib/studio-document';

interface StudioRevisionPanelProps<T extends PhoenixStudioDocument> {
  projectId: string;
  kind: PhoenixStudioDocumentKind;
  enabled: boolean;
  onRestore: (document: T) => void;
  onError?: (message: string) => void;
}

export function StudioRevisionPanel<T extends PhoenixStudioDocument>({
  projectId,
  kind,
  enabled,
  onRestore,
  onError,
}: StudioRevisionPanelProps<T>) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<StudioDocumentRevisionSummary[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');

  const reportError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    setStatus(message);
    onError?.(message);
  };

  const load = async () => {
    if (!enabled) return;
    try {
      setRows(await dbGetStudioDocumentHistory(projectId, kind));
    } catch (error) {
      reportError(error, 'Failed to load timeline history.');
    }
  };

  if (!enabled) {
    return <Button size="sm" variant="ghost" disabled title="Timeline recovery requires Studio Cloud mode.">Versions</Button>;
  }

  const createSnapshot = async () => {
    setBusy('snapshot');
    setStatus('');
    try {
      await dbCreateStudioDocumentSnapshot(projectId, kind, label);
      setLabel('');
      setStatus('Snapshot saved.');
      await load();
    } catch (error) {
      reportError(error, 'Timeline snapshot failed.');
    } finally {
      setBusy('');
    }
  };

  const restore = async (row: StudioDocumentRevisionSummary) => {
    setBusy(row.id);
    setStatus('');
    try {
      const restored = await dbRestoreStudioDocument<T>(projectId, kind, row.id);
      onRestore(restored);
      setStatus(`Restored version ${row.version}. A pre-restore backup was created.`);
      await load();
    } catch (error) {
      reportError(error, 'Timeline restore failed.');
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
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        Versions
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-[12000] w-[340px] rounded-xl border border-white/10 bg-[#070b15] p-3 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-white">Timeline Recovery</div>
              <div className="text-[10px] text-slate-500">Automatic checkpoints + named snapshots</div>
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
                    <div className="text-[9px] text-slate-500">v{row.version} · {new Date(row.created_at).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="ghost" loading={busy === row.id} onClick={() => void restore(row)}>Restore</Button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-[11px] text-slate-600">
                No cloud checkpoints yet. Save one now or continue editing for automatic checkpoints.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
