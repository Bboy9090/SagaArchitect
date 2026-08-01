import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDocumentDescendantIds, hasWritingVersionConflict, isWritingDocumentKind, isWritingDocumentStatus } from '../src/lib/writing-sync';
import { compileWritingProject, importWritingBackup, moveWritingDocument, orderedWritingDocuments, reparentWritingScene } from '../src/lib/writing-documents';
import { createDocxPackage, createEpubPackage } from '../src/lib/publishing-packages';
import { OutlineValidationError, validateWritingOutlineChanges } from '../src/lib/writing-outline';
import { analyzePublishingReadiness } from '../src/lib/publishing-preflight';

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

test('outline movement changes sibling order without breaking scene hierarchy', () => {
  const chapterTwo: WritingDocument = { ...sampleDocuments[1], id: 'chapter-2', title: 'Chapter Two', order: 3 };
  const moved = moveWritingDocument([...sampleDocuments, chapterTwo], 'chapter-2', -1);
  assert.deepEqual(moved.map(document => document.id), ['chapter-2', 'chapter', 'scene']);
  assert.equal(moved.find(document => document.id === 'scene')?.parent_id, 'chapter');
});

test('scene reassignment is bounded to chapters and normalizes production order', () => {
  const chapterTwo: WritingDocument = { ...sampleDocuments[1], id: 'chapter-2', title: 'Chapter Two', order: 3 };
  const reassigned = reparentWritingScene([...sampleDocuments, chapterTwo], 'scene', 'chapter-2');
  assert.equal(reassigned.find(document => document.id === 'scene')?.parent_id, 'chapter-2');
  assert.throws(() => reparentWritingScene(sampleDocuments, 'chapter', 'chapter'));
  assert.throws(() => reparentWritingScene(sampleDocuments, 'scene', 'missing'));
});

test('malformed cyclic outlines remain finite and preserve every document', () => {
  const cyclic = sampleDocuments.map(document => document.id === 'chapter' ? { ...document, parent_id: 'scene' } : document);
  const ordered = orderedWritingDocuments(cyclic);
  assert.equal(ordered.length, 2);
  assert.deepEqual(new Set(ordered.map(document => document.id)), new Set(['chapter', 'scene']));
});

test('atomic cloud outline contract requires exact IDs, versions, order, and nesting', () => {
  const existing = [{ id: 'chapter', kind: 'chapter', version: 4 }, { id: 'scene', kind: 'scene', version: 2 }];
  assert.deepEqual(validateWritingOutlineChanges(existing, [
    { id: 'chapter', order: 0, version: 4 },
    { id: 'scene', parent_id: 'chapter', order: 1, version: 2 },
  ]), [
    { id: 'chapter', parentId: null, order: 0, version: 4 },
    { id: 'scene', parentId: 'chapter', order: 1, version: 2 },
  ]);
  assert.throws(() => validateWritingOutlineChanges(existing, [{ id: 'chapter', order: 0, version: 4 }]), (error: unknown) => error instanceof OutlineValidationError && error.status === 409);
  assert.throws(() => validateWritingOutlineChanges(existing, [{ id: 'chapter', order: 0, version: 3 }, { id: 'scene', order: 1, version: 2 }]), (error: unknown) => error instanceof OutlineValidationError && error.status === 409);
  assert.throws(() => validateWritingOutlineChanges(existing, [{ id: 'chapter', parent_id: 'scene', order: 0, version: 4 }, { id: 'scene', order: 1, version: 2 }]), (error: unknown) => error instanceof OutlineValidationError && error.status === 400);
});

test('publishing preflight blocks structural failures and reports editorial warnings', () => {
  const report = analyzePublishingReadiness('Phoenix Test', sampleDocuments);
  assert.equal(report.ready, true);
  assert.equal(report.errors, 0);
  assert.ok(report.warnings >= 2);
  const broken = analyzePublishingReadiness('', [
    { ...sampleDocuments[0], content: '', parent_id: 'missing' },
    { ...sampleDocuments[1], content: '' },
  ]);
  assert.equal(broken.ready, false);
  assert.ok(broken.issues.some(issue => issue.code === 'missing_project_title'));
  assert.ok(broken.issues.some(issue => issue.code === 'missing_parent'));
  assert.ok(broken.issues.some(issue => issue.code === 'empty_document'));
});

test('publishing packages exclude private notes while backups retain them', () => {
  const note: WritingDocument = { ...sampleDocuments[1], id: 'note', kind: 'notes', title: 'Private Research', content: 'Do not publish this.', order: 4 };
  const files = storedZipEntries(createEpubPackage('Phoenix Test', [...sampleDocuments, note]));
  assert.doesNotMatch(files['EPUB/manuscript.xhtml'], /Private Research|Do not publish this/);
});
