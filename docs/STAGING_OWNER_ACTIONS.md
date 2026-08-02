# Staging Owner Action Checklist

These actions require external provider-dashboard access and cannot be completed by repository code alone. Never paste secret values into GitHub issues, pull requests, commits, chat transcripts, screenshots, or evidence receipts.

## 1. Security prerequisite

- [ ] Rotate or revoke the historically exposed database credential.
- [ ] Confirm the old credential fails authentication.
- [ ] Review Git history, Actions artifacts, deployment logs, and retained local copies for the exposed value.
- [ ] Set GitHub Environment variable `CREDENTIAL_ROTATION_CONFIRMED=true` only after evidence is recorded.
- [ ] Set GitHub Environment variable `HISTORY_REVIEW_CONFIRMED=true` only after review is complete.

## 2. Supabase staging project

- [ ] Create or confirm a Supabase project used only for Phoenix Creator Studio staging.
- [ ] Confirm it contains no production users, projects, assets, or credentials.
- [ ] Create a private storage bucket used only for staging assets.
- [ ] Record the bucket name as GitHub Environment variable `STAGING_SUPABASE_STORAGE_BUCKET`.
- [ ] Obtain a serverless-compatible runtime pooler URL for `STAGING_DATABASE_URL`.
- [ ] Obtain a separate migration-safe database URL for `STAGING_DATABASE_MIGRATION_URL`.
- [ ] Store the project URL as secret `STAGING_SUPABASE_URL`.
- [ ] Store the service-role key as secret `STAGING_SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Apply schema migrations once through the migration-safe connection before acceptance.

The runtime and migration URLs must not be identical. Do not run migrations from an application request, readiness probe, or every Vercel build.

## 3. Upstash staging database

- [ ] Create an Upstash Redis database used only for staging rate limits and probes.
- [ ] Store the REST endpoint as secret `STAGING_RATE_LIMIT_URL`.
- [ ] Store the REST token as secret `STAGING_RATE_LIMIT_TOKEN`.
- [ ] Confirm staging does not share keys or credentials with production.

## 4. Vercel staging deployment

- [ ] Connect `Bboy9090/SagaArchitect` to a dedicated staging Vercel project or isolated staging environment.
- [ ] Deploy the exact commit selected for acceptance.
- [ ] Configure `APP_ENV=staging` and `NODE_ENV=production`.
- [ ] Configure the staging environment variables from `docs/ENVIRONMENT_VARIABLES_STAGING.md`.
- [ ] Set `STORAGE_PROVIDER=supabase`.
- [ ] Set `RATE_LIMIT_PROVIDER=upstash`.
- [ ] Set `FEATURE_PROJECT_RESTORE=true` for the recovery drill.
- [ ] Set `ENABLE_TEST_AUTH_BYPASS=false`.
- [ ] Set `DEPLOYMENT_COMMIT_SHA` to the exact deployed 40-character commit.
- [ ] Set `ROLLBACK_COMMIT_SHA` to the last verified rollback commit.
- [ ] Verify `/api/health/deployment` identifies the correct commit and staging providers.
- [ ] Verify `/api/health/ready` returns healthy without exposing secret values.

## 5. Protected GitHub Environment

Create or update the GitHub Environment named `staging`.

### Required secrets

- [ ] `STAGING_DATABASE_URL`
- [ ] `STAGING_DATABASE_MIGRATION_URL`
- [ ] `STAGING_NEXTAUTH_SECRET`
- [ ] `STAGING_SUPABASE_URL`
- [ ] `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- [ ] `STAGING_RATE_LIMIT_URL`
- [ ] `STAGING_RATE_LIMIT_TOKEN`

### Required variables

- [ ] `PRODUCTION_BASE_URL`
- [ ] `STAGING_SUPABASE_STORAGE_BUCKET`
- [ ] `CREDENTIAL_ROTATION_CONFIRMED`
- [ ] `HISTORY_REVIEW_CONFIRMED`
- [ ] `ROLLBACK_REHEARSAL_CONFIRMED`

Keep the three confirmation variables false until their receipts exist. Browser pass variables are intentionally unsupported; Chromium, Firefox, and WebKit classifications come only from generated Playwright evidence.

## 6. Run isolated staging acceptance

Open GitHub Actions and dispatch `Phoenix Creator Studio Staging Acceptance` with:

- [ ] `staging_base_url`: exact HTTPS staging URL
- [ ] `expected_commit_sha`: exact deployed commit
- [ ] `rollback_commit_sha`: verified rollback commit
- [ ] `approval_phrase`: `RUN_ISOLATED_STAGING_ACCEPTANCE`

The workflow must pass:

- [ ] environment policy
- [ ] deployment identity
- [ ] live Supabase probe
- [ ] live Upstash probe
- [ ] `PCS-CHR-1440`
- [ ] `PCS-FF-1440`
- [ ] `PCS-WK-1440`
- [ ] authenticated API and recovery drill
- [ ] final cleanup
- [ ] deterministic evidence receipt

## 7. Rehearse rollback

- [ ] Preserve the immutable current deployment URL.
- [ ] Preserve the immutable rollback deployment URL.
- [ ] Dispatch `Phoenix Creator Studio Staging Rollback Rehearsal` with the required approval phrase.
- [ ] Confirm the staging alias moves to the rollback deployment and passes readiness.
- [ ] Confirm the alias returns to the current deployment and passes readiness.
- [ ] Review the rollback artifact.
- [ ] Set `ROLLBACK_REHEARSAL_CONFIRMED=true` only after the receipt passes.

## 8. Classification decision

- [ ] Download and retain the staging acceptance artifact.
- [ ] Verify evidence digests and cleanup counts.
- [ ] Confirm all three browser receipts contain actual browser versions and screenshots.
- [ ] Record unresolved defects.
- [ ] Keep release-candidate status blocked unless staging, browser, rollback, credential, and history gates all pass.
