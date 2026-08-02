import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationError, FeatureDisabledError, ValidationError } from '../src/lib/api-errors';
import { assertFeatureEnabled, isFeatureEnabled, resolvedFeatureFlags } from '../src/lib/feature-flags';
import {
  canonicalJson,
  idempotencyRecordId,
  idempotencyRequestHash,
  readIdempotencyKey,
} from '../src/lib/idempotency';
import { expectedVersionFromRequest, parseVersionValue, versionEtag } from '../src/lib/optimistic-concurrency';
import { buildProjectDeletionReceipt, requiredProjectDeletionConfirmation } from '../src/lib/data-lifecycle';

test('idempotency keys are validated and normalized from request headers', () => {
  const valid = new Request('https://studio.example.test/api/db/projects', {
    headers: { 'Idempotency-Key': 'create-project:12345678' },
  });
  assert.equal(readIdempotencyKey(valid), 'create-project:12345678');
  assert.equal(readIdempotencyKey(new Request('https://studio.example.test')), null);

  const invalid = new Request('https://studio.example.test', {
    headers: { 'Idempotency-Key': 'short' },
  });
  assert.throws(() => readIdempotencyKey(invalid), ValidationError);
});

test('idempotency request hashing is stable across object key order and scoped by user and route', () => {
  const left = { name: 'Project', nested: { z: 2, a: 1 }, tags: ['one', 'two'] };
  const right = { tags: ['one', 'two'], nested: { a: 1, z: 2 }, name: 'Project' };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(idempotencyRequestHash(left), idempotencyRequestHash(right));

  const first = idempotencyRecordId('user-a', '/api/db/projects', 'same-key-123');
  const second = idempotencyRecordId('user-b', '/api/db/projects', 'same-key-123');
  const third = idempotencyRecordId('user-a', '/api/db/assets/upload', 'same-key-123');
  assert.notEqual(first, second);
  assert.notEqual(first, third);
  assert.equal(first.length, 64);
});

test('feature flags default safely and accept explicit emergency overrides', () => {
  assert.equal(isFeatureEnabled('projectCreation', {}), true);
  assert.equal(isFeatureEnabled('accountDeletion', {}), false);
  assert.equal(isFeatureEnabled('projectDeletion', { FEATURE_PROJECT_DELETION: 'off' }), false);
  assert.equal(isFeatureEnabled('accountDeletion', { FEATURE_ACCOUNT_DELETION: 'enabled' }), true);
  assert.throws(
    () => isFeatureEnabled('assetUpload', { FEATURE_ASSET_UPLOAD: 'maybe' }),
    ConfigurationError,
  );

  const flags = resolvedFeatureFlags({ FEATURE_CANON_SCAN: 'disabled' });
  assert.equal(flags.canonScan, false);
  assert.throws(
    () => assertFeatureEnabled('projectDeletion', { FEATURE_PROJECT_DELETION: 'false' }),
    FeatureDisabledError,
  );
});

test('optimistic concurrency accepts body or If-Match versions and rejects ambiguity', () => {
  assert.equal(parseVersionValue(3), 3);
  assert.equal(parseVersionValue('W/"4"'), 4);
  assert.equal(parseVersionValue('0'), null);
  assert.equal(versionEtag(5), '"5"');

  const bodyOnly = expectedVersionFromRequest(new Request('https://studio.example.test'), { expected_version: 7 });
  assert.equal(bodyOnly, 7);

  const headerOnly = expectedVersionFromRequest(
    new Request('https://studio.example.test', { headers: { 'If-Match': '"8"' } }),
    {},
  );
  assert.equal(headerOnly, 8);

  assert.throws(
    () => expectedVersionFromRequest(
      new Request('https://studio.example.test', { headers: { 'If-Match': '"9"' } }),
      { expected_version: 10 },
    ),
    ValidationError,
  );
  assert.throws(
    () => expectedVersionFromRequest(new Request('https://studio.example.test'), {}),
    ValidationError,
  );
});

test('project deletion receipts require exact human-readable confirmation', () => {
  assert.equal(requiredProjectDeletionConfirmation('My Project'), 'DELETE My Project');
  const receipt = buildProjectDeletionReceipt({
    projectId: 'project-1',
    projectName: 'My Project',
    userId: 'user-1',
    confirmation: 'DELETE My Project',
    now: new Date('2026-08-02T16:00:00.000Z'),
  });
  assert.deepEqual(receipt, {
    operation: 'project_delete',
    projectId: 'project-1',
    projectName: 'My Project',
    requestedBy: 'user-1',
    confirmedAt: '2026-08-02T16:00:00.000Z',
    retention: 'audit-receipt-only',
  });
  assert.throws(
    () => buildProjectDeletionReceipt({
      projectId: 'project-1',
      projectName: 'My Project',
      userId: 'user-1',
      confirmation: 'delete my project',
    }),
    ValidationError,
  );
});
