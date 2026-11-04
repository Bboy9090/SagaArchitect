'use client';

import type { ProjectAsset } from '@/lib/db-client';
import {
  isRelinkAssetCompatible,
  type PhoenixMissingMediaReference,
} from '@/lib/video-timeline';

interface MissingMediaPanelProps {
  references: PhoenixMissingMediaReference[];
  assets: ProjectAsset[];
  onRelink: (reference: PhoenixMissingMediaReference, asset: ProjectAsset) => void;
}

export function MissingMediaPanel({ references, assets, onRelink }: MissingMediaPanelProps) {
  if (references.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[.22em] text-amber-300">Missing Media</div>
        <span className="rounded bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-200">{references.length}</span>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        Relink broken project assets without resetting clip timing, motion, effects, or automation.
      </p>
      <div className="mt-3 space-y-2">
        {references.map(reference => {
          const compatible = assets.filter(asset => isRelinkAssetCompatible(reference.clipKind, asset.mime_type));
          return (
            <div key={reference.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-white">{reference.label}</div>
                  <div className="mt-0.5 text-[8px] uppercase tracking-wider text-slate-500">
                    {reference.kind === 'source-keyframe' ? 'Pose/source swap' : reference.clipKind + ' clip'}
                  </div>
                </div>
                {reference.locked && <span className="text-[8px] font-bold uppercase text-amber-300">Locked</span>}
              </div>
              <select
                defaultValue=""
                disabled={reference.locked || compatible.length === 0}
                onChange={event => {
                  const asset = compatible.find(item => item.id === event.target.value);
                  if (asset) onRelink(reference, asset);
                  event.currentTarget.value = '';
                }}
                className="mt-2 min-h-9 w-full rounded border border-white/10 bg-[#0a0d14] px-2 text-[9px] text-white disabled:opacity-50"
                aria-label={'Relink ' + reference.label}
              >
                <option value="">
                  {reference.locked ? 'Unlock track to relink' : compatible.length ? 'Choose replacement…' : 'Upload compatible media first'}
                </option>
                {compatible.map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}
