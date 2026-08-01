import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDocumentDescendantIds, hasWritingVersionConflict, isWritingDocumentKind, isWritingDocumentStatus } from '../src/lib/writing-sync';
import { compileWritingProject, importWritingBackup } from '../src/lib/writing-documents';
import type { WritingDocument } from '../src/lib/types';

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

test('optimistic versions reject stale and unknown cloud writes', () => {
  assert.equal(hasWritingVersionConflict(4, 4), false);
  assert.equal(hasWritingVersionConflict(3, 4), true);
  assert.equal(hasWritingVersionConflict(undefined, 4), true);
});

const sampleDocuments: WritingDocument[] = [
  { id: 'scene', project_id: 'project', parent_id: 'chapter', title: 'Scene One', kind: 'scene', status: 'draft', content: 'Scene words.', order: 2, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'chapter', project_id: 'project', title: 'Chapter One', kind: 'chapter', status: 'draft', content: 'Chapter words.', order: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
];

test('whole-project compilation preserves hierarchy and production order', () => {
  const compiled = compileWritingProject('Phoenix Test', sampleDocuments, true);
  assert.ok(compiled.indexOf('## Chapter One') < compiled.indexOf('### Scene One'));
  assert.match(compiled, /Chapter words\.[\s\S]*Scene words\./);
});

test('backup import validates its schema and remaps document hierarchy', () => {
  let id = 0;
  const imported = importWritingBackup({ schema: 'phoenix_creator_studio.writing_backup.v1', documents: sampleDocuments }, 'destination', () => `new-${++id}`, '2026-02-01');
  assert.equal(imported[0].project_id, 'destination');
  assert.equal(imported[1].parent_id, imported[0].id);
  assert.throws(() => importWritingBackup({ schema: 'unknown', documents: [] }, 'destination', () => 'x'));
});
