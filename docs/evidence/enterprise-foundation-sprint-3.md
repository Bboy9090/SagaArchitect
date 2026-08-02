# Enterprise Foundation Sprint 3 Evidence

Tracking issue: #39  
Working branch: `enterprise/foundation-sprint-3`  
Base commit: `91a058484d9d081dc4e9e5b34f55c21d855af387`

## Classification rule

A capability is not classified as **implemented** until the full CI evidence gate passes with its real code path and focused success/failure tests. Repository-wide integration, staging, emulator, hardware, and release-candidate classifications require separate evidence.

## Current status

| Move | Capability | Classification | Current evidence |
|---:|---|---|---|
| 10 | Idempotency-key framework | Pending verification | Durable DB receipt table, canonical request hashing, conflict/replay logic, and project-creation integration added |
| 11 | Optimistic concurrency | Pending verification | Project GET emits version ETag; PUT requires expected version and uses atomic compare-and-update |
| 12 | Feature flags and kill switches | Pending verification | Typed server flags added; project creation/deletion gates connected; account deletion defaults disabled |
| 13 | Dependency, license, and SBOM gate | Pending verification | Deterministic CycloneDX generator, prohibited-license policy, npm high-severity audit, CI artifacts added |
| 14 | Data lifecycle | Pending verification | Durable lifecycle event table and project-deletion audit receipt connected |

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

- `POST /api/db/projects`
  - server feature gate
  - optional `Idempotency-Key`
  - durable replay/conflict receipt
- `GET /api/db/projects/:id`
  - version ETag
- `PUT /api/db/projects/:id`
  - `If-Match`, `expected_version`, or current `version`
  - atomic update only when the stored version matches
  - increments the server-owned version
- `DELETE /api/db/projects/:id`
  - feature gate
  - explicit project-ID confirmation header
  - durable deletion receipt preserved outside the project cascade
- browser database client
  - generates project-creation idempotency keys
  - supplies update preconditions
  - supplies delete confirmation header

## Honest limits

- Idempotency is initially connected only to project creation; migration import and asset upload remain later integrations.
- Feature flags are initially connected only to project creation and deletion; the remaining named routes are not yet gated.
- Project deletion retains an audit receipt, but account export/deletion, retention scheduling, and recovery windows are not implemented.
- The dependency policy blocks known high-risk license families and reports unknown license metadata; legal review is still required for commercial distribution.
- No production, staging, emulator, hardware, or release-candidate claim is made.
