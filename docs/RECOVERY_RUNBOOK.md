# Phoenix Creator Studio Recovery Runbook

## Purpose

This runbook defines the first operator-controlled recovery lane for project data. It covers metadata backup export, integrity preflight, readiness checks, and evidence collection. It does not authorize automatic restore into production.

## Recovery tiers

| Tier | RPO target | RTO target | Restore-evidence cadence |
|---|---:|---:|---:|
| Critical | 15 minutes | 60 minutes | 30 days |
| Standard | 24 hours | 8 hours | 90 days |
| Archival | 7 days | 72 hours | 180 days |

These are policy targets. A tier is not validated until a timed restore exercise has passed in a named environment.

## Backup procedure

1. Authenticate as the project owner.
2. Send `POST /api/db/projects/{projectId}/backup`.
3. Store the returned JSON package in access-controlled storage.
4. Record the response headers:
   - `X-Backup-Sha256`
   - `X-Lifecycle-Receipt-Id`
5. Store asset files separately. The initial project backup contains asset metadata, not asset bytes.
6. Protect backups with encryption at rest, restricted access, retention limits, and separate credentials from the primary application.

## Integrity preflight

1. Send the saved package to `POST /api/db/projects/{projectId}/restore/preflight`.
2. Require `valid: true` before considering the package restorable.
3. Review warnings, especially the explicit warning that asset bytes require separate recovery evidence.
4. Record the lifecycle receipt ID.
5. Do not mutate production from this endpoint. It is validation-only.

## Readiness procedure

Use `GET /api/health/ready` for orchestrator readiness checks.

- HTTP 200 with `ready`: all required dependencies passed.
- HTTP 200 with `degraded`: required dependencies passed, but an optional dependency is unavailable.
- HTTP 503 with `unready`: at least one required dependency failed.

The endpoint checks configuration without returning secrets. External uptime monitoring and alerting remain required.

## Incident sequence

1. Freeze destructive operations using server feature flags.
2. Capture the current readiness response and deployment identifier.
3. Preserve database and storage evidence before changing state.
4. Select the newest backup that meets the project's RPO target.
5. Run restore preflight and verify the SHA-256 integrity result.
6. Restore only in an isolated environment using a separately approved restore implementation.
7. Validate ownership boundaries, project counts, writing documents, scenes, storyboard panels, canon scan, history restore, and asset availability.
8. Record elapsed recovery time against the RTO target.
9. Obtain explicit approval before production cutover.
10. Preserve incident, restore, and validation evidence.

## Current limits

- No automatic database import or production overwrite exists in Sprint 4.
- Backup packages omit asset bytes.
- Readiness does not prove performance capacity or regional availability.
- Recovery objectives are unvalidated until exercised in staging.
- Account-wide export and deletion remain separate work.
