import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backupSha256,
  createProjectBackup,
  validateProjectBackup,
} from '../src/lib/project-backup';
import { evaluateReadiness } from '../src/lib/readiness';
import { assessRecoveryObjective, recoveryObjectiveFor } from '../src/lib/recovery-objectives';

test('project backup manifest is deterministic for equivalent payloads', () => {
  const generatedAt = new Date('2026-08-02T12:00:00.000Z');
  const first = createProjectBackup({
    project: { name: 'Alpha', id: 'project-1', updatedAt: new Date('2026-08-01T00:00:00.000Z') },
    collections: { scenes: [{ title: 'Opening', id: 'scene-1' }], characters: [] },
  }, generatedAt);
  const second = createProjectBackup({
    project: { updatedAt: new Date('2026-08-01T00:00:00.000Z'), id: 'project-1', name: 'Alpha' },
    collections: { characters: [], scenes: [{ id: 'scene-1', title: 'Opening' }] },
  }, generatedAt);

  assert.equal(first.manifest.payloadSha256, second.manifest.payloadSha256);
  assert.equal(backupSha256(first.payload), first.manifest.payloadSha256);
  assert.deepEqual(first.manifest.entityCounts, { characters: 0, scenes: 1 });
});

test('restore preflight accepts intact metadata-only backup', () => {
  const backup = createProjectBackup({
    project: { id: 'project-2', name: 'Beta' },
    collections: { assets: [{ id: 'asset-1', storageProvider: 'supabase' }], writingDocuments: [] },
  }, new Date('2026-08-02T12:00:00.000Z'));

  const report = validateProjectBackup(backup, { expectedProjectId: 'project-2' });
  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.match(report.warnings[0], /Asset bytes are not included/);
});

test('restore preflight rejects tampering and wrong target project', () => {
  const backup = createProjectBackup({
    project: { id: 'project-3', name: 'Gamma' },
    collections: { scenes: [{ id: 'scene-1' }] },
  }, new Date('2026-08-02T12:00:00.000Z'));
  backup.payload.collections.scenes.push({ id: 'scene-2' });

  const report = validateProjectBackup(backup, { expectedProjectId: 'project-other' });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some(error => /target project/.test(error)));
  assert.ok(report.errors.some(error => /entity counts/.test(error)));
  assert.ok(report.errors.some(error => /integrity hash/.test(error)));
});

test('readiness is unready for required failures and degraded for optional failures', () => {
  const unready = evaluateReadiness([
    { name: 'database', required: true, ok: false },
    { name: 'ai-provider', required: false, ok: false },
  ], new Date('2026-08-02T12:00:00.000Z'));
  assert.equal(unready.state, 'unready');
  assert.equal(unready.httpStatus, 503);
  assert.deepEqual(unready.failedRequired, ['database']);

  const degraded = evaluateReadiness([
    { name: 'database', required: true, ok: true },
    { name: 'ai-provider', required: false, ok: false },
  ], new Date('2026-08-02T12:00:00.000Z'));
  assert.equal(degraded.state, 'degraded');
  assert.equal(degraded.httpStatus, 200);
});

test('recovery objective assessment distinguishes partial, pass, and fail evidence', () => {
  const target = recoveryObjectiveFor('critical');
  assert.equal(target.rpoMinutes, 15);
  assert.equal(target.rtoMinutes, 60);

  const partial = assessRecoveryObjective('critical', {
    backupCreatedAt: new Date('2026-08-02T11:50:00.000Z'),
    now: new Date('2026-08-02T12:00:00.000Z'),
  });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.rpoMet, true);
  assert.equal(partial.rtoMet, null);

  const pass = assessRecoveryObjective('critical', {
    backupCreatedAt: new Date('2026-08-02T11:50:00.000Z'),
    recoveryCompletedInMinutes: 45,
    now: new Date('2026-08-02T12:00:00.000Z'),
  });
  assert.equal(pass.status, 'pass');

  const fail = assessRecoveryObjective('critical', {
    backupCreatedAt: new Date('2026-08-02T11:00:00.000Z'),
    recoveryCompletedInMinutes: 90,
    now: new Date('2026-08-02T12:00:00.000Z'),
  });
  assert.equal(fail.status, 'fail');
  assert.equal(fail.rpoMet, false);
  assert.equal(fail.rtoMet, false);
});
