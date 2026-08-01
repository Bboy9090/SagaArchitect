import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDocumentDescendantIds, hasWritingVersionConflict, isWritingDocumentKind, isWritingDocumentStatus } from '../src/lib/writing-sync';
import { compileWritingProject, importWritingBackup } from '../src/lib/writing-documents';
import { createDocxPackage, createEpubPackage } from '../src/lib/publishing-packages';

function storedZipEntries(archive: Uint8Array): Record<string, string> {
  const entries: Record<string, string> = {};
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= archive.length && new DataView(archive.buffer, archive.byteOffset + offset).getUint32(0, true) === 0x04034b50) {
    const view = new DataView(archive.buffer, archive.byteOffset + offset);
    const size = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(archive.slice(nameStart, nameStart + nameLength));
    entries[name] = decoder.decode(archive.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}
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

test('DOCX publishing package contains valid manuscript and package relationships', () => {
  const files = storedZipEntries(createDocxPackage('Phoenix & Fire', sampleDocuments));
  assert.ok(files['[Content_Types].xml']);
  assert.ok(files['_rels/.rels']);
  assert.ok(files['word/styles.xml']);
  const document = files['word/document.xml'];
  assert.match(document, /Phoenix &amp; Fire/);
  assert.ok(document.indexOf('Chapter One') < document.indexOf('Scene One'));
  assert.match(document, /Chapter words\.[\s\S]*Scene words\./);
});

test('EPUB publishing package contains navigation and escaped ordered XHTML', () => {
  const files = storedZipEntries(createEpubPackage('Phoenix & Fire', sampleDocuments));
  assert.equal(files.mimetype, 'application/epub+zip');
  assert.ok(files['META-INF/container.xml']);
  assert.ok(files['EPUB/package.opf']);
  const navigation = files['EPUB/nav.xhtml'];
  const manuscript = files['EPUB/manuscript.xhtml'];
  assert.match(navigation, /Chapter One/);
  assert.match(manuscript, /Phoenix &amp; Fire/);
  assert.ok(manuscript.indexOf('Chapter One') < manuscript.indexOf('Scene One'));
});
