# Enterprise Foundation Sprint 5 Evidence

Tracking issue: #43  
Draft pull request: #44  
Working branch: `enterprise/foundation-sprint-5`  
Base commit: `dd7957c8e4de75c7dda80b1b92b3390569f42a24`

## Goal

Advance Phoenix Creator Studio from merged enterprise foundations into staging acceptance and verified recovery without making a premature release-candidate claim.

## Scope

20. Staging environment contract and deployment validation
21. Durable storage adapter integration
22. Distributed rate-limit adapter integration
23. Asset-byte backup and transactional restore foundations
24. Browser vertical-slice acceptance suite
25. Staging evidence, rollback receipt, and release-readiness assessment

## Current classifications

| Move | Capability | Classification | Evidence |
|---:|---|---|---|
| 20 | Staging environment contract | **Implemented** | Strict staging deployment validation, isolated-provider requirements, commit/rollback receipts, focused success/failure tests, and passing CI |
| 21 | Durable storage adapter | **Integrated — repository paths** | Supabase provider is connected through provider-neutral upload, private serve, delete, backup-read, and readiness paths; live Supabase staging remains unvalidated |
| 22 | Distributed rate limiting | **Integrated — repository paths** | Upstash adapter is connected to configured limiter, readiness, registration, asset upload, backup, and restore-preflight policies; live Upstash staging remains unvalidated |
| 23 | Full recovery foundations | **Implemented — partial move** | Deterministic version-2 asset-byte backup, per-asset integrity checks, rate-limited export, and version-aware restore preflight exist; transactional restore is still pending |
| 24 | Browser vertical-slice acceptance | Not yet classified | Acceptance contract and named browser matrix exist; no Playwright execution yet |
| 25 | Staging release-readiness assessment | Not yet classified | Evidence and rollback templates exist; no real staging deployment receipt yet |

## Code and route changes in this checkpoint

### Staging validation

- `src/lib/env-schema.ts`
- `src/lib/env-validator.ts`
- `scripts/check-env.mjs`
- `package.json` (`env:check:staging`)

Staging deployment validation now requires:

- `APP_ENV=staging`
- remote HTTPS Auth.js URL
- unique staging authentication secret
- separate runtime and migration database URLs
- Supabase Storage
- Upstash rate limiting
- full deployment and rollback commit SHAs
- explicit `STAGING_CONFIRM_ISOLATED=true`
- test authentication bypass disabled

### Durable assets

- `src/lib/storage/asset-storage.ts`
- `src/app/api/db/assets/upload/route.ts`
- `src/app/api/db/assets/[id]/serve/route.ts`
- `src/app/api/db/assets/[id]/route.ts`
- `src/app/api/health/ready/route.ts`

The asset lifecycle now selects the configured provider for save/read/delete, stores provider-neutral object references, applies upload rate limits, serves authenticated assets with private caching, and performs real readiness probes.

### Recovery

- `src/lib/project-backup-assets.ts`
- `src/app/api/db/projects/[id]/backup/route.ts`
- `src/app/api/db/projects/[id]/restore/preflight/route.ts`
- `src/lib/rate-limit/policies.ts`

Version-2 backups can include bounded asset bytes, per-asset hashes, deterministic descriptor hashes, asset counts, and total-byte evidence. Restore preflight recognizes both metadata-only version 1 packages and asset-inclusive version 2 packages.

## Operational documentation

- `docs/STAGING_PROVIDER_DECISION.md`
- `docs/STAGING_ACCEPTANCE.md`
- `docs/ENVIRONMENT_VARIABLES_STAGING.md`
- `docs/ROLLBACK_STAGING.md`
- `docs/STAGING_EVIDENCE_TEMPLATE.md`
- `docs/STAGING_IMPLEMENTATION_PLAN.md`
- `docs/STAGING_OWNER_ACTIONS.md`
- `docs/SECURITY_CREDENTIAL_ROTATION.md`

## Focused tests

- `tests/enterprise-foundation-sprint-5.test.ts`

The tests cover:

- valid isolated staging configuration
- wrong provider and shared database URL rejection
- localhost and incomplete commit-evidence rejection
- safe generated asset keys
- provider-neutral asset save/read/exists/delete behavior
- deterministic asset-byte backup validation
- tampered asset-byte rejection

## Passing CI evidence

Workflow: `Fan-Favorite Foundation`  
Run ID: `30759021279`  
Run number: `167`  
Evidence commit: `a7cd680c1594a56f2281c93391ed993db251abfe`  
Artifact: `phoenix-creator-studio-foundation` (`8836866477`)  
Artifact digest: `sha256:b10fc37d0bb79fbb756f1fff97a9b05a8a8b53f55daa30ecf261f93544cbdd11`

Every enforced step passed:

- locked dependency installation
- secret scan
- dependency policy and SBOM
- isolated PostgreSQL schema application
- lint
- typecheck
- environment validation
- focused enterprise tests
- production build
- isolated server startup
- authentication and ownership regression
- canon-scanner regression
- history restore and export regression
- repository smoke contract
- final evidence gate

## Security prerequisite

The database credential previously committed in historical verification scripts must be treated as compromised. Rotation/revocation and history-purge review remain owner-controlled blockers for any staging or release-candidate declaration.

## Remaining work

- implement transactional isolated restore with full ID remapping and rollback cleanup
- connect migration-created storyboard assets to the provider-neutral storage path
- run the provider adapters against real isolated Supabase and Upstash staging services
- add and execute Playwright Chromium, Firefox, and WebKit acceptance configurations
- conduct a staging rollback rehearsal
- record credential rotation and Git-history purge evidence
- declare release-candidate status only after every release gate passes

## Classification policy

- `implemented`: a real code path exists and focused automated tests pass.
- `integrated`: caller and dependency paths are connected and exercised together.
- `emulator-validated`: reproduced under a named browser/emulator configuration.
- `hardware-validated`: reproduced on identified physical hardware.
- `release candidate`: declared release gates pass; release is not yet published.

No higher classification is claimed without matching evidence.
