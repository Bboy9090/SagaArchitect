# Phoenix Creator Studio — Live Staging Workflow Runbook

## Workflow

`Phoenix Creator Studio Staging Acceptance`

The workflow is manual, uses the protected GitHub Environment named `staging`, checks out the exact commit supplied at dispatch, and refuses to run without the exact approval phrase:

```text
RUN_ISOLATED_STAGING_ACCEPTANCE
```

## Required GitHub Environment secrets

- `STAGING_DATABASE_URL`
- `STAGING_DATABASE_MIGRATION_URL`
- `STAGING_NEXTAUTH_SECRET`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_RATE_LIMIT_URL`
- `STAGING_RATE_LIMIT_TOKEN`

## Required GitHub Environment variables

- `PRODUCTION_BASE_URL`
- `STAGING_SUPABASE_STORAGE_BUCKET`

The workflow compares the staging URL with `PRODUCTION_BASE_URL` and stops if they match.

## Release-decision variables

These variables do not bypass tests. They only record whether separately controlled gates have evidence:

- `CREDENTIAL_ROTATION_CONFIRMED`
- `HISTORY_REVIEW_CONFIRMED`
- `ROLLBACK_REHEARSAL_CONFIRMED`
- `PCS_FF_1440_VALIDATED`
- `PCS_WK_1440_VALIDATED`

Set a variable to `true` only after its corresponding receipt is reviewed. False or missing values keep release-candidate eligibility blocked.

## Deployment requirements

The exact deployed staging revision must expose:

```text
GET /api/health/deployment
```

The response must identify:

- environment `staging`
- exact commit SHA
- storage provider `supabase`
- rate-limit provider `upstash`
- project restore enabled for the drill
- test authentication bypass disabled

The deployment must also pass:

```text
GET /api/health/ready
```

All required dependencies must be healthy.

## Dispatch inputs

- `staging_base_url`: exact HTTPS staging deployment
- `expected_commit_sha`: exact deployed 40-character commit
- `rollback_commit_sha`: last verified rollback revision
- `approval_phrase`: exact approval phrase

## Executed evidence lanes

1. Staging environment policy validation
2. Deployment identity verification
3. Live Supabase bucket/object write-read-delete verification
4. Live Upstash atomic counter and TTL verification
5. `PCS-CHR-1440` Chromium registration, secure-cookie, dashboard, runtime-error, and screenshot verification
6. Authenticated API vertical slice
7. Private asset upload/read/delete
8. Asset-byte backup and restore preflight
9. Transactional restore and idempotent replay
10. Restored asset byte comparison
11. Project, asset, account, and session cleanup
12. Deterministic staging classification receipt

## Evidence artifact

The workflow uploads `phoenix-creator-studio-staging-acceptance`, including:

- environment validation log
- deployment identity
- provider evidence
- Chromium version and browser evidence
- screenshot
- API/recovery acceptance evidence
- run metadata
- staging classification receipt

## Classification boundaries

A successful workflow may support:

- live Supabase validation
- live Upstash validation
- live staging acceptance
- `PCS-CHR-1440` emulator validation

It does not prove:

- `PCS-FF-1440`
- `PCS-WK-1440`
- physical-hardware validation
- credential rotation
- Git-history review
- rollback rehearsal
- release-candidate eligibility unless every separate gate is also confirmed
