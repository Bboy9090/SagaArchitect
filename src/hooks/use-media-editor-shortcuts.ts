'use client';

import { useEffect } from 'react';

interface MediaEditorShortcutActions {
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onNudge: (dx: number, dy: number) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}

export function useMediaEditorShortcuts(actions: MediaEditorShortcutActions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (command && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) actions.onRedo();
        else actions.onUndo();
        return;
      }

      if (command && key === 'y') {
        event.preventDefault();
        actions.onRedo();
        return;
      }

      if (command && key === 'd') {
        event.preventDefault();
        actions.onDuplicate();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        actions.onDelete();
        return;
      }

      if (event.key.startsWith('Arrow')) {
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        if (dx || dy) {
          event.preventDefault();
          actions.onNudge(dx, dy);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
