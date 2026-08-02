# Enterprise Foundation Sprint 4 Evidence

Tracking issue: #41  
Working branch: `enterprise/foundation-sprint-4`  
Base commit: `c8ff351b52cfc1c005eec285db891a68935a2ca5`

## Scope

15. Deterministic project backup package and manifest
16. Restore preflight integrity validation
17. Durable backup and restore-preflight lifecycle receipts
18. Dependency-aware readiness endpoint
19. Recovery objective policy and operator runbook

## Classification rule

A capability is not classified as **implemented** until the exact branch head passes focused success/failure tests, dependency policy, schema application, lint, typecheck, build, server startup, ownership/canon/history regressions, smoke tests, and the final CI enforcement step.

## Current status

| Move | Capability | Classification | Verified evidence |
|---:|---|---|---|
| 15 | Deterministic project backup | Implemented | Canonical JSON package, stable SHA-256 payload manifest, entity counts, owned export route, focused deterministic/tamper tests |
| 16 | Restore preflight | Implemented | Format/version, project target, structure, entity-count, timestamp, asset-mode, and payload-integrity validation with success/failure tests |
| 17 | Lifecycle receipts | Implemented | Durable completed backup-export receipt and completed/failed restore-preflight receipts |
| 18 | Readiness endpoint | Implemented | Required/optional dependency model, ready/degraded/unready states, HTTP 200/503 behavior, database probe, safe configuration checks |
| 19 | Recovery objectives | Implemented | Critical/standard/archival RPO and RTO policy, evidence assessment, and operator-controlled recovery runbook |

## Verification receipt

Implementation head: `d310470b59bb90165ab34edebda9a3e86466e26d`  
GitHub Actions run: `30757043591` / workflow run #139  
Artifact digest: `sha256:05d472768f3fd2751d581a5ee40830f907fcc31fa6f46d563e9b38526b944d36`

The run passed locked installation, secret scanning, dependency/license/SBOM policy, schema application, lint, typecheck, focused enterprise tests, production build, application startup, authentication and ownership regression, canon regression, history/export regression, smoke tests, evidence upload, and final gate enforcement.

## Real code paths

- `src/lib/project-backup.ts`
- `src/app/api/db/projects/[id]/backup/route.ts`
- `src/app/api/db/projects/[id]/restore/preflight/route.ts`
- `src/lib/readiness.ts`
- `src/app/api/health/ready/route.ts`
- `src/lib/recovery-objectives.ts`
- `src/lib/data-lifecycle.ts`
- `tests/enterprise-foundation-sprint-4.test.ts`
- `docs/RECOVERY_RUNBOOK.md`

## Honest limits

- Backup packages contain database records and asset metadata, not local or remote asset bytes.
- Restore is preflight-only; no destructive or automatic import is authorized.
- Readiness is not a substitute for external uptime, latency, regional, or capacity monitoring.
- Recovery objectives remain policy targets until exercised against a named staging environment.
- Account-wide export/deletion and scheduled retention remain separate work.
- No staging, emulator, hardware, disaster-recovery exercise, or release-candidate claim is made.
