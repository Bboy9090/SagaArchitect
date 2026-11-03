'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  createPhoenixMediaDocumentFile,
  parsePhoenixMediaDocumentFile,
  phoenixMediaDocumentFileName,
  type PhoenixMediaDocument,
} from '@/lib/media-composition';

interface MediaDocumentIOProps {
  document: PhoenixMediaDocument;
  onImport: (document: PhoenixMediaDocument) => void;
  onError?: (message: string) => void;
}

export function MediaDocumentIO({ document, onImport, onError }: MediaDocumentIOProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const exportNative = () => {
    const payload = createPhoenixMediaDocumentFile(document);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = phoenixMediaDocumentFileName(document);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importNative = async (file: File) => {
    setImporting(true);
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('Phoenix document exceeds the 12 MB editor limit.');
      const raw = await file.text();
      const imported = parsePhoenixMediaDocumentFile(
        raw,
        document.projectId,
        document.kind,
        document.version,
      );
      onImport(imported);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Phoenix document import failed.');
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={exportNative}>Phoenix File</Button>
      <Button size="sm" variant="ghost" loading={importing} onClick={() => inputRef.current?.click()}>Import</Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void importNative(file);
        }}
        aria-label="Import Phoenix media document"
      />
    </>
  );
}
