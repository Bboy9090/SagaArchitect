# Sprint 5 Implementation Plan

## Track A — Close completed enterprise tracking

- close Sprint 1 after final evidence comment
- keep Sprint 2 open until durable storage and distributed rate limiting are truly integrated
- close Sprint 3 after final merge/evidence comment
- close Sprint 4 after final merge/evidence comment

## Track B — Staging contract

- add explicit staging environment validation command
- fail on local storage, memory rate limiting, test auth bypass, insecure auth URL, or missing migration connection
- add deployment metadata and rollback target validation

## Track C — Durable dependencies

- implement private durable object-storage adapter
- implement shared distributed rate-limit adapter
- connect upload, read, delete, readiness, migration sketches, backup, and restore callers
- preserve local adapters for development and isolated tests

## Track D — Recovery

- extend backup packages to include asset bytes or verifiable object references
- verify per-asset hashes
- implement transactional restore into an isolated target project
- prevent ownership reassignment and cross-tenant reference injection
- produce backup, preflight, restore, and cleanup receipts

## Track E — Browser acceptance

- add Playwright configuration for Chromium, Firefox, and WebKit
- use an explicit `BASE_URL`; never silently target production
- verify the complete creator workflow and cleanup
- store traces/screenshots only on failure unless an evidence run requests full artifacts

## Track F — Release readiness

- record exact staging commit and deployment
- run readiness, browser, recovery, and rollback drills
- classify only proven levels
- do not declare RC until the credential-rotation/history-purge gate and all staging checks pass
