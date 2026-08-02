# Enterprise Foundation Sprint 3 Evidence

Tracking issue: #39  
Draft pull request: #40  
Working branch: `enterprise/foundation-sprint-3`  
Base commit: `91a058484d9d081dc4e9e5b34f55c21d855af387`

## Classification rule

A capability is classified as **implemented** only after the full CI evidence gate passes with a real code path, focused success/failure tests, supply-chain evidence, lint, type checking, production build, isolated PostgreSQL, application startup, and existing ownership/canon/history regressions.

Repository-wide integration, staging, emulator, hardware, and release-candidate classifications require separate evidence.

## Final Sprint 3 status

| Move | Capability | Classification | Evidence |
|---:|---|---|---|
| 10 | Idempotency-key framework | **Implemented** | Durable receipt table, canonical request hashing, replay/conflict behavior, project-creation connection, focused tests, and isolated DB gate |
| 11 | Optimistic concurrency | **Implemented** | Project ETags, required preconditions, atomic compare-and-update, server-owned version increments, client connection, focused tests, and build/regression gate |
| 12 | Feature flags and kill switches | **Implemented** | Typed server flags, fail-safe parsing, project create/delete enforcement, account deletion disabled by default, focused tests, and environment documentation |
| 13 | Dependency, license, and SBOM gate | **Implemented** | Tracked-secret scan, deterministic CycloneDX SBOM, prohibited-license policy, high-severity npm audit, dependency repairs, and retained CI artifacts |
| 14 | Data lifecycle | **Implemented** | Durable lifecycle event table, confirmed project-deletion path, retained deletion receipt, focused confirmation tests, and isolated ownership regression evidence |

## Real code paths

- `src/db/enterprise-schema.ts`
- `src/db/migrations/0005_enterprise_foundation_sprint_3.sql`
- `src/lib/idempotency.ts`
- `src/lib/optimistic-concurrency.ts`
- `src/lib/feature-flags.ts`
- `src/lib/data-lifecycle.ts`
- `scripts/check-dependency-policy.mjs`
- `scripts/generate-sbom.mjs`
- `tests/enterprise-foundation-sprint-3.test.ts`

## Controlled integrations

### Project creation

`POST /api/db/projects`

- server feature gate
- optional validated `Idempotency-Key`
- durable processing/completed receipt
- conflict when a key is reused for a different payload
- replay of the stored response for a completed identical request
- history and idempotency receipt committed in one transaction

### Project concurrency

`GET /api/db/projects/:id`

- emits the current project version as an ETag

`PUT /api/db/projects/:id`

- accepts `If-Match`, `expected_version`, or the current body `version`
- rejects missing, malformed, contradictory, or stale preconditions
- uses one atomic owner-and-version-qualified update
- increments the server-owned version
- records the previous and resulting version in history

### Project deletion lifecycle

`DELETE /api/db/projects/:id`

- server feature gate
- authenticated ownership verification
- explicit `X-Confirm-Project-Id` confirmation
- durable lifecycle receipt written before the project cascade
- deletion history written in the same transaction
- retained audit record identifies the actor, subject, project, operation, and disposition without retaining project content

### Browser database client

- generates project-creation idempotency keys
- supplies project update version preconditions
- supplies project deletion confirmation headers

### Supply-chain gate

The enterprise CI now enforces and retains:

- locked dependency installation
- tracked-file secret scan
- prohibited-license scan
- unknown-license report
- deterministic CycloneDX 1.5 SBOM
- high-severity npm audit
- isolated schema application
- lint and TypeScript
- focused Sprint 1–3 tests
- production build
- isolated application startup and database health
- authentication/ownership regression
- deterministic canon scanner regression
- history restore and export regression
- repository smoke contract

## Passing evidence

Workflow: `Fan-Favorite Foundation`  
Run ID: `30756426309`  
Run number: `136`  
Evidence commit: `95096211b91c59631fd149969df5e049745d33b8`  
Artifact: `phoenix-creator-studio-foundation` (`8836070158`)  
Artifact digest: `sha256:ac8866a7531096a96a1c7f92b51556a531898a910f2816cce8e0ba1a255e54d5`

Every enforced step passed, including the final foundation gate.

## Dependency remediation performed

- The repository's high-severity `js-yaml` path was moved to a fixed compatible release.
- The vulnerable `brace-expansion` graph was repaired through npm's non-breaking audit resolution rather than a forced incompatible global override.
- The remaining reported `esbuild` development-server advisory is moderate severity and is inherited through the current Drizzle tooling path; resolving it requires a separate Drizzle toolchain upgrade review rather than an unsafe forced downgrade.

## Honest limits

- Idempotency is connected to project creation only; migration import and asset upload remain later integrations.
- Feature flags are connected to project creation and deletion only; the remaining named routes are not yet gated.
- Project deletion retains an audit receipt, but account export/deletion, retention scheduling, legal hold, recovery windows, and deletion completion notifications are not implemented.
- The dependency policy reports licensing metadata and blocks selected high-risk license families; it is technical evidence, not legal advice or a substitute for commercial-license review.
- The current project type contract now exposes the server version but otherwise preserves the existing canonical type surface.
- No production deployment, staging acceptance, emulator validation, physical-hardware validation, soak test, or release-candidate claim is made.
