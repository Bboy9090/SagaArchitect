# Enterprise Foundation Sprint 6 Evidence

Tracking issue: #45  
Draft pull request: #46  
Working branch: `enterprise/foundation-sprint-6`  
Base merge commit: `f2f9248157610f48eb0188f0b6187874f40170f1`

## Goal

Prepare the first live, isolated staging acceptance lane without confusing repository readiness with live-service, browser, hardware, or release-candidate evidence.

## Scope

26. Live staging orchestration and fail-closed approval gates
27. Live Supabase Storage and Upstash dependency verification
28. Production-like Auth.js cookie and session hardening
29. Authenticated staging API vertical-slice runner
30. Named browser acceptance harness
31. Recovery, cleanup, and rollback evidence capture
32. Release-readiness decision record

## Current classifications

| Move | Capability | Classification | Evidence |
|---:|---|---|---|
| 26 | Staging orchestration | **Implemented** | Protected manual workflows, exact commit/rollback inputs, approval phrases, staging/production URL separation, protected environment secrets, failure-safe evidence and cleanup gates |
| 27 | Live provider verification | **Implemented** | Real Supabase bucket/object write-read-delete probe and Upstash atomic EVAL/TTL/delete probe exist; they have not yet run against owner-configured live staging services |
| 28 | Production-like auth hardening | **Implemented** | Staging/preview secure-cookie policy, remote HTTPS assertion, typed session IDs, safe deployment identity, focused success/failure tests, and full repository CI |
| 29 | Staging API vertical slice | **Implemented** | Authenticated registration/session/project/character/scene/storyboard/asset/backup/preflight/restore/replay/sign-out/cleanup runner exists; no live staging run yet |
| 30 | Browser acceptance | **Implemented** | Named `PCS-CHR-1440` Chromium registration, dashboard, secure-cookie, runtime-error, screenshot, and cleanup harness exists; no emulator-validation claim until it runs successfully |
| 31 | Staging recovery and rollback | **Implemented** | Final cleanup receipt and reversible staging-alias rollback/undo workflow exist; no rollback-rehearsal claim until the workflow succeeds |
| 32 | Release-readiness decision | **Implemented** | Deterministic staging receipt records exact evidence, missing artifacts, browser classifications, security gates, recovery receipts, staging decision, and RC blockers |

## Auth.js staging hardening

Code paths:

- `src/lib/auth-security.ts`
- `src/types/next-auth.d.ts`
- `src/lib/auth-options.ts`
- `src/lib/auth-helpers.ts`
- `src/lib/deployment-identity.ts`
- `src/app/api/health/deployment/route.ts`

Staging and preview deployments now use secure Auth.js cookie names and attributes. Deployment URLs fail closed unless they are remote HTTPS URLs. The public deployment identity endpoint exposes only environment, commit, rollback commit, provider names, restore-feature state, and test-bypass state; it does not expose credentials or connection strings.

## Live provider verification

Code path:

- `scripts/verify-live-staging-providers.mjs`

The provider probe requires `APP_ENV=staging` and explicit isolation confirmation. It:

- probes the configured private Supabase bucket
- writes a unique object
- reads it back and verifies SHA-256
- deletes it and verifies it is no longer readable
- exercises the same atomic Upstash EVAL counter/TTL pattern used by the application
- deletes the probe key
- emits a machine-readable non-secret evidence file

## Authenticated vertical slice

Code path:

- `verify-staging-acceptance.js`

The runner verifies:

- exact deployment identity and readiness
- registration and real Auth.js credentials sign-in
- Secure, HttpOnly, SameSite=Lax session and CSRF cookie evidence
- session identity
- project, character, scene, private asset, and storyboard creation
- private asset cache policy and retrieval
- asset-byte backup and restore preflight
- transactional restore-as-new-project
- idempotent restore replay
- restored asset byte equality
- asset/project cleanup
- sign-out and protected-route rejection
- deterministic direct staging-user cleanup fallback

## Named Chromium configuration

Code path:

- `verify-staging-browser.js`

Configuration:

```text
PCS-CHR-1440
Chromium/Chrome
1440×900
```

The harness verifies registration UI rendering, browser-based automatic sign-in, dashboard arrival, secure session-cookie policy, browser console/page/request failures, screenshot generation, and user cleanup.

Firefox and WebKit remain separate unvalidated configurations:

- `PCS-FF-1440`
- `PCS-WK-1440`

## Staging workflows

- `.github/workflows/staging-acceptance.yml`
- `.github/workflows/staging-rollback-rehearsal.yml`
- `scripts/cleanup-staging-acceptance.mjs`
- `scripts/generate-staging-receipt.mjs`
- `docs/STAGING_WORKFLOW_RUNBOOK.md`

The acceptance workflow uses the protected GitHub Environment `staging`, checks out the exact deployed commit, verifies live providers, executes the Chromium and authenticated recovery lanes, always performs final cleanup, emits a deterministic receipt, uploads artifacts, and enforces every outcome.

The rollback workflow validates immutable current and rollback deployments, points only the isolated staging alias to the verified rollback deployment, confirms readiness, restores the alias to the original deployment even after rollback-step failure, verifies restoration, and records both outcomes. It does not touch the production URL.

## Focused tests

- `tests/enterprise-foundation-sprint-6.test.ts`

Tests cover:

- staging/preview secure-cookie policy
- fail-closed missing, HTTP, and localhost Auth.js URLs
- valid remote staging URL
- safe deployment identity fields
- malformed commit/provider rejection
- test-auth bypass not reported outside isolated tests

## Passing repository CI evidence

Workflow: `Fan-Favorite Foundation`  
Run ID: `30761824594`  
Run number: `195`  
Evidence commit: `38022f0b3c894f87c265274812baf73b557720e0`  
Artifact: `phoenix-creator-studio-foundation` (`8837699666`)  
Artifact digest: `sha256:264973dc3090b5f1469cf967af62d2867813131afecec6c2d1f83eea38dddf33`

Every enforced repository gate passed:

- locked dependency installation
- secret scan
- dependency policy and CycloneDX SBOM
- isolated PostgreSQL schema application
- lint
- typecheck
- environment policy validation
- focused Sprint 1–6 tests
- production build
- isolated server startup
- authentication and ownership regression
- canon-scanner regression
- history restore and export regression
- transactional project restore regression
- repository smoke contract
- final evidence gate

## Honest limits

The repository CI proves the harness and security code paths compile, build, and pass focused/local integration tests. It does not prove:

- a Vercel staging deployment exists
- live Supabase object storage passed
- live Upstash rate limiting passed
- `PCS-CHR-1440` passed against staging
- Firefox or WebKit passed
- physical hardware passed
- rollback rehearsal passed
- the exposed historical credential was rotated or revoked
- Git history and retained artifacts were purged/reviewed
- release-candidate gates passed

## Owner-controlled blockers

- rotate or revoke the historically exposed database credential
- prove the old credential no longer authenticates
- complete Git-history and retained-artifact review
- configure isolated Vercel, Supabase, and Upstash staging resources
- store staging-only secrets in the protected GitHub `staging` environment
- deploy the exact merge commit and run the staging workflows

No secret values belong in this ledger.
