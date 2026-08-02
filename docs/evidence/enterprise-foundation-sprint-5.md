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
23. Asset-byte backup and transactional restore
24. Browser vertical-slice acceptance suite
25. Staging evidence, rollback receipt, and release-readiness assessment

## Current classifications

| Move | Capability | Classification | Evidence |
|---:|---|---|---|
| 20 | Staging environment contract | **Implemented** | Strict staging deployment validation, isolated-provider requirements, commit/rollback receipts, focused success/failure tests, and passing CI |
| 21 | Durable storage adapter | **Integrated — repository and isolated CI paths** | Provider-neutral upload, private serve, delete, migration sketches, backup reads, restore writes, compensating cleanup, and readiness paths are connected and exercised with the local isolated adapter; live Supabase staging remains unvalidated |
| 22 | Distributed rate limiting | **Integrated — repository paths** | Upstash adapter is connected to configured limiter, readiness, registration, migration, asset upload, backup, restore preflight, and restore policies; live Upstash staging remains unvalidated |
| 23 | Asset-byte backup and transactional restore | **Integrated — isolated CI** | Version-2 backup, strict preflight, full ID remapping, ownership preservation, restore-as-new-project, idempotent replay, durable receipt, asset retrieval, database rollback, and compensating storage cleanup passed an end-to-end isolated CI run |
| 24 | Browser vertical-slice acceptance | Not yet classified | Acceptance contract and named browser matrix exist; no Playwright execution yet |
| 25 | Staging release-readiness assessment | Not yet classified | Evidence and rollback templates exist; no real staging deployment receipt yet |

## Staging validation

Code paths:

- `src/lib/env-schema.ts`
- `src/lib/env-validator.ts`
- `scripts/check-env.mjs`
- `package.json` (`env:check:staging`)

Staging deployment validation requires:

- `APP_ENV=staging`
- remote HTTPS Auth.js URL
- unique staging authentication secret
- separate runtime and migration database URLs
- Supabase Storage
- Upstash rate limiting
- full deployment and rollback commit SHAs
- explicit `STAGING_CONFIRM_ISOLATED=true`
- test authentication bypass disabled

## Durable assets

Code paths:

- `src/lib/storage/asset-storage.ts`
- `src/lib/storage/supabase-storage-provider.ts`
- `src/app/api/db/assets/upload/route.ts`
- `src/app/api/db/assets/[id]/serve/route.ts`
- `src/app/api/db/assets/[id]/route.ts`
- `src/app/api/migration/import/route.ts`
- `src/app/api/health/ready/route.ts`

The asset lifecycle now selects the configured provider for save, read, delete, migration, backup, restore, failure cleanup, and readiness probing. Authenticated asset responses use private caching. Storyboard mutations now reject cross-project asset references and use bounded request bodies.

## Transactional recovery

Code paths:

- `src/lib/project-backup-assets.ts`
- `src/lib/project-restore.ts`
- `src/app/api/db/projects/[id]/backup/route.ts`
- `src/app/api/db/projects/[id]/restore/preflight/route.ts`
- `src/app/api/db/projects/[id]/restore/route.ts`
- `src/lib/feature-flags.ts`
- `src/lib/data-lifecycle.ts`
- `src/lib/rate-limit/policies.ts`

Recovery behavior now includes:

- bounded version-2 backup packages with actual asset bytes
- deterministic payload and asset descriptor hashes
- per-asset size, MIME, and signature verification
- strict source-project and cross-entity reference validation
- fresh UUID remapping for project, factions, characters, locations, timeline events, arcs, lore, generated stories, writing documents, scenes, assets, and storyboard panels
- relationship, parent, faction, location, scene, and asset-reference remapping
- authenticated ownership preservation
- restore-as-new-project rather than destructive overwrite
- an explicit restore feature flag disabled by default
- exact restore confirmation header
- mandatory idempotency key and duplicate replay protection
- a single database transaction for restored records and receipts
- compensating object-storage deletion when persistence fails
- durable lifecycle and version-history receipts

## Verification

Focused tests:

- `tests/enterprise-foundation-sprint-5.test.ts`

End-to-end integration verification:

- `verify-project-restore.js`

The verification creates a source project, scene, uploaded image, and storyboard panel, exports an asset-inclusive backup, restores it into a distinct owned project, replays the same request idempotently, verifies remapped database references and served bytes, forces a database failure after asset persistence, and confirms both database rollback and compensating storage cleanup.

## Passing CI evidence

Workflow: `Fan-Favorite Foundation`  
Run ID: `30760869947`  
Run number: `181`  
Evidence commit: `e806400ece55c7d3d8262fcbb7386f461e73b020`  
Artifact: `phoenix-creator-studio-foundation` (`8837412844`)  
Artifact digest: `sha256:f4d1a600ae461ce48f03e9c6516a71435086be9edc821dbdd877df2816c7b6c4`

Every enforced step passed:

- locked dependency installation
- secret scan
- dependency policy and CycloneDX SBOM
- isolated PostgreSQL schema application
- lint
- typecheck
- environment validation
- focused Sprint 1–5 enterprise tests
- production build
- isolated server startup
- authentication and ownership regression
- canon-scanner regression
- history restore and export regression
- transactional project restore, idempotency, receipt, asset-byte, and compensation regression
- repository smoke contract
- final evidence gate

## Operational documentation

- `docs/STAGING_PROVIDER_DECISION.md`
- `docs/STAGING_ACCEPTANCE.md`
- `docs/ENVIRONMENT_VARIABLES_STAGING.md`
- `docs/ROLLBACK_STAGING.md`
- `docs/STAGING_EVIDENCE_TEMPLATE.md`
- `docs/STAGING_IMPLEMENTATION_PLAN.md`
- `docs/STAGING_OWNER_ACTIONS.md`
- `docs/SECURITY_CREDENTIAL_ROTATION.md`

## Security prerequisite

The database credential previously committed in historical verification scripts must be treated as compromised. Rotation/revocation and history-purge review remain owner-controlled blockers for any staging or release-candidate declaration.

## Remaining work

- run the provider adapters against real isolated Supabase and Upstash staging services
- add and execute Playwright Chromium, Firefox, and WebKit acceptance configurations
- verify real Auth.js cookies and session persistence in staging
- conduct and record a staging rollback rehearsal
- record credential rotation/revocation and Git-history purge evidence
- complete the flagship browser vertical slice and cleanup receipt
- declare release-candidate status only after every release gate passes

## Classification policy

- `implemented`: a real code path exists and focused automated tests pass.
- `integrated`: caller and dependency paths are connected and exercised together.
- `emulator-validated`: reproduced under a named browser/emulator configuration.
- `hardware-validated`: reproduced on identified physical hardware.
- `release candidate`: declared release gates pass; release is not yet published.

No higher classification is claimed without matching evidence.
