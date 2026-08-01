import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDocumentDescendantIds, isWritingDocumentKind, isWritingDocumentStatus } from '../src/lib/writing-sync';

test('writing document contracts accept only supported kinds and statuses', () => {
  assert.equal(isWritingDocumentKind('screenplay'), true);
  assert.equal(isWritingDocumentKind('executable'), false);
  assert.equal(isWritingDocumentStatus('revision'), true);
  assert.equal(isWritingDocumentStatus('published'), false);
});

test('recursive document deletion remains inside the selected hierarchy', () => {
  const documents = [
    { id: 'manuscript', parentId: null },
    { id: 'chapter-a', parentId: 'manuscript' },
    { id: 'scene-a', parentId: 'chapter-a' },
    { id: 'chapter-b', parentId: null },
  ];
  assert.deepEqual(new Set(collectDocumentDescendantIds(documents, 'chapter-a')), new Set(['chapter-a', 'scene-a']));
});
