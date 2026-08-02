# Phoenix Creator Studio — Staging Rollback Procedure

## Purpose

Rollback returns staging to the last verified application revision without pretending that database changes can always be reversed safely.

## Preconditions

- identify the exact deployed commit
- identify the last verified rollback commit
- capture the current readiness result
- capture database migration state
- capture current storage provider and bucket
- stop destructive staging acceptance runs

## Application rollback

1. Freeze new staging writes where practical.
2. Record the failing deployment identifier and commit SHA.
3. Redeploy the last verified application commit.
4. Re-run `/api/health/ready`.
5. Verify login, project read, asset read, and export on preserved staging data.
6. Record the rollback deployment identifier and result.

## Database handling

Application rollback does not automatically reverse migrations.

- Prefer forward-compatible additive migrations.
- Use a forward-fix migration when rollback would destroy or reinterpret data.
- Execute a down migration only when it was explicitly written, reviewed, and tested against a disposable staging clone.
- Never restore an older database snapshot over current staging without first preserving the failed state for investigation.

## Storage handling

- Do not delete durable staging assets during application rollback.
- Confirm the rollback version can still read existing storage keys.
- Use lifecycle receipts to identify assets created by a failed acceptance run.
- Delete only verified test artifacts during cleanup.

## Completion receipt

Record:

- incident/request ID
- failing commit and deployment
- rollback commit and deployment
- migration state before and after
- readiness result
- authentication check
- data-read check
- asset-read check
- export check
- unresolved risks
- operator and timestamp
