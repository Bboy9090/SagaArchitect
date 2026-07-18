'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/Navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { isDbMode } from '@/lib/storage-mode';
import type { CanonScanResult, CanonIssueSeverity } from '@/types/canon-issues';

interface CanonPageProps {
  params: Promise<{ id: string }>;
}

export default function CanonScanPage({ params }: CanonPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<CanonScanResult | null>(null);
  const [loading, setLoading] = useState(() => isDbMode());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | CanonIssueSeverity>('all');

  const runScan = useCallback(async (showScanningSpinner = false) => {
    if (!isDbMode()) {
      return;
    }
    if (showScanningSpinner) setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/db/projects/${id}/scan-canon`);
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
      } else {
        setError(json.error || 'Failed to scan canon integrity.');
      }
    } catch {
      setError('A network error occurred while running the scan.');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isDbMode()) {
      return;
    }
    fetch(`/api/db/projects/${id}/scan-canon`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setResult(json.data);
        else setError(json.error || 'Failed to scan canon integrity.');
      })
      .catch(() => setError('A network error occurred while running the scan.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!isDbMode()) {
    return (
      <Navigation>
        <Header title="Canon Integrity Scanner" subtitle="Database mode required" />
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <div className="bg-[#121217] border border-amber-500/20 rounded-xl p-8 max-w-md mx-auto shadow-2xl">
            <span className="text-4xl">🗄️</span>
            <h3 className="text-xl font-bold text-white mt-4">Database Mode Required</h3>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              Canon integrity scanning reads relationships across all tables and is only available in PostgreSQL Database Mode.
            </p>
            <Button variant="gold" className="mt-6" onClick={() => router.push(`/universe/${id}`)}>
              Back to Project
            </Button>
          </div>
        </div>
      </Navigation>
    );
  }

  if (loading) {
    return (
      <Navigation>
        <div className="flex items-center justify-center h-64">
          <Spinner text="Initializing integrity scan..." />
        </div>
      </Navigation>
    );
  }

  const issues = result?.issues || [];
  const filteredIssues = severityFilter === 'all'
    ? issues
    : issues.filter(i => i.severity === severityFilter);

  const getSeverityBadgeClass = (severity: CanonIssueSeverity) => {
    switch (severity) {
      case 'error':
        return 'bg-rose-950/40 border border-rose-500/30 text-rose-300';
      case 'warning':
        return 'bg-amber-950/40 border border-amber-500/30 text-amber-300';
      case 'info':
        return 'bg-blue-950/40 border border-blue-500/30 text-blue-300';
    }
  };

  return (
    <Navigation>
      <Header
        title="Canon Integrity Scanner"
        subtitle="Deterministic diagnostic suite for worldbuilding consistency"
        actions={
          <div className="flex gap-2">
            <Button
              variant="gold"
              size="sm"
              loading={scanning}
              onClick={() => runScan(true)}
            >
              🔄 Refresh Scan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/universe/${id}`)}
            >
              Back to Project
            </Button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 mb-6 text-rose-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Diagnostic Dashboard Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-xl p-4 shadow-xl">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Diagnostic Issues</p>
            <p className="text-3xl font-extrabold text-[#c9a84c] mt-1">{result?.totalIssues || 0}</p>
          </div>
          <div
            onClick={() => setSeverityFilter('error')}
            className={`bg-[#0f0f1a] border rounded-xl p-4 cursor-pointer transition-all shadow-xl ${
              severityFilter === 'error' ? 'border-rose-500/60 bg-rose-950/5' : 'border-[#c9a84c]/10 hover:border-rose-500/40'
            }`}
          >
            <p className="text-[10px] text-rose-400/80 uppercase tracking-wider">Errors (Blockers)</p>
            <p className="text-3xl font-extrabold text-rose-400 mt-1">{result?.countsBySeverity.error || 0}</p>
          </div>
          <div
            onClick={() => setSeverityFilter('warning')}
            className={`bg-[#0f0f1a] border rounded-xl p-4 cursor-pointer transition-all shadow-xl ${
              severityFilter === 'warning' ? 'border-amber-500/60 bg-amber-950/5' : 'border-[#c9a84c]/10 hover:border-amber-500/40'
            }`}
          >
            <p className="text-[10px] text-amber-400/80 uppercase tracking-wider">Warnings (Continuity)</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-1">{result?.countsBySeverity.warning || 0}</p>
          </div>
          <div
            onClick={() => setSeverityFilter('info')}
            className={`bg-[#0f0f1a] border rounded-xl p-4 cursor-pointer transition-all shadow-xl ${
              severityFilter === 'info' ? 'border-blue-500/60 bg-blue-950/5' : 'border-[#c9a84c]/10 hover:border-blue-500/40'
            }`}
          >
            <p className="text-[10px] text-blue-400/80 uppercase tracking-wider">Info (Placeholder/Deferred)</p>
            <p className="text-3xl font-extrabold text-blue-400 mt-1">{result?.countsBySeverity.info || 0}</p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {(['all', 'error', 'warning', 'info'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  severityFilter === sev
                    ? 'bg-[#c9a84c] text-black border-transparent shadow-lg shadow-[#c9a84c]/10'
                    : 'bg-[#121217] text-gray-400 border-gray-800 hover:border-gray-700'
                }`}
              >
                {sev.toUpperCase()} ({sev === 'all' ? issues.length : result?.countsBySeverity[sev] || 0})
              </button>
            ))}
          </div>
          <span className="text-[10px] text-gray-500">
            Last Scanned: {result?.scannedAt ? new Date(result.scannedAt).toLocaleTimeString() : 'Never'}
          </span>
        </div>

        {/* Scan List */}
        {filteredIssues.length === 0 ? (
          <div className="bg-[#0f0f1a] border border-[#c9a84c]/10 rounded-2xl p-12 text-center shadow-2xl">
            <span className="text-5xl">🛡️</span>
            <h4 className="text-lg font-bold text-white mt-4">Canon Clean & Consistent</h4>
            <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              No diagnostic issues found under the current filters. Your creative timeline and references are structurally integrated.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="bg-[#0f0f1a] border border-[#c9a84c]/15 hover:border-[#c9a84c]/30 rounded-xl p-5 shadow-2xl transition-all duration-200"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getSeverityBadgeClass(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                        {issue.entityType} · {issue.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white mt-2">{issue.title}</h4>
                    <p className="text-gray-300 text-sm leading-relaxed mt-1">{issue.explanation}</p>
                  </div>
                </div>

                {issue.suggestedFix && (
                  <div className="bg-[#12121c]/80 border-l-2 border-[#c9a84c]/50 rounded px-4 py-3 mt-4 text-xs">
                    <span className="font-bold text-[#c9a84c] block mb-1">🛠️ Suggested Fix</span>
                    <p className="text-gray-400 leading-relaxed">{issue.suggestedFix}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Navigation>
  );
}
