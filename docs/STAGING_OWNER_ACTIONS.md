# Staging Owner Action Checklist

These actions require external provider-dashboard access and cannot be completed by repository code alone. Never paste secret values into GitHub issues, pull requests, commits, chat transcripts, screenshots, or evidence receipts.

## 1. Security prerequisite

- [ ] Rotate or revoke the historically exposed database credential.
- [ ] Confirm the old credential fails authentication.
- [ ] Review Git history, Actions artifacts, deployment logs, and retained local copies for the exposed value.
- [ ] Set GitHub Environment variable `CREDENTIAL_ROTATION_CONFIRMED=true` only after evidence is recorded.
- [ ] Set GitHub Environment variable `HISTORY_REVIEW_CONFIRMED=true` only after review is complete.

## 2. Supabase staging resources

Provider/runtime credentials stay inside the Vercel staging environment. They are not copied into GitHub Actions.

- [ ] Create or confirm a Supabase project used only for Phoenix Creator Studio staging.
- [ ] Confirm it contains no production users, projects, assets, or credentials.
- [ ] Create a private staging asset bucket.
- [ ] Obtain a serverless-compatible runtime pooler URL.
- [ ] Obtain a separate migration-safe database URL.
- [ ] Store `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` only in the Vercel staging environment.
- [ ] Use a dedicated non-`public` schema such as `phoenix_staging`.
- [ ] Apply schema migrations through the reviewed staging deployment path.

The runtime and migration URLs must not be identical. Do not run migrations from an application request or readiness probe.

## 3. Upstash staging resources

- [ ] Create or select an isolated Upstash Redis database/namespace for staging.
- [ ] Store `RATE_LIMIT_URL` and `RATE_LIMIT_TOKEN` only in the Vercel staging environment.
- [ ] Configure `RATE_LIMIT_NAMESPACE=pcs:staging:phoenix` or another isolated staging namespace.
- [ ] Confirm staging does not share rate-limit keys with production.

## 4. Vercel staging deployment

The dedicated Git branch `staging` is the only branch allowed to auto-deploy through Vercel Git.

- [ ] Configure Vercel Preview variables for the `staging` branch:
  - `APP_ENV=staging`
  - `NODE_ENV=production`
  - `NEXTAUTH_URL=https://<stable-staging-host>`
  - `DATABASE_SCHEMA=phoenix_staging`
  - `STORAGE_PROVIDER=supabase`
  - `RATE_LIMIT_PROVIDER=upstash`
  - `RATE_LIMIT_NAMESPACE=pcs:staging:phoenix`
  - `FEATURE_PROJECT_RESTORE=true`
  - `ENABLE_TEST_AUTH_BYPASS=false`
  - `ALLOW_REMOTE_TESTS=true`
- [ ] Store `NEXTAUTH_SECRET` and `STAGING_AUTOMATION_TOKEN` only in Vercel staging secrets.
- [ ] Set `STAGING_CONFIRM_ISOLATED=true` only after provider isolation is proven.
- [ ] Enable `RUN_STAGING_MIGRATIONS=true` only for the reviewed staging migration deployment; disable it again after the migration evidence is recorded.
- [ ] Ensure the exact deployed commit is exposed through Vercel's Git commit metadata.
- [ ] Verify `/api/health/deployment` reports the intended commit/providers/namespaces without secret values.
- [ ] Verify `/api/health/ready` is healthy before acceptance.

## 5. Protected GitHub Environment

Create or update the GitHub Environment named `staging`.

### Acceptance secrets

- [ ] `STAGING_AUTOMATION_TOKEN` — the same dedicated automation token configured in Vercel staging.
- [ ] `VERCEL_AUTOMATION_BYPASS_SECRET` — generated in Vercel Deployment Protection for automated access to protected staging deployments.

### Rollback-only control-plane secrets

- [ ] `STAGING_VERCEL_API_TOKEN` — fresh token limited to the staging Vercel account/project scope where possible.
- [ ] `STAGING_VERCEL_ORG_ID`
- [ ] `STAGING_VERCEL_PROJECT_ID`

These control-plane values are used only by the rollback rehearsal to move the isolated staging alias. They are not application runtime credentials.

### Required non-secret variables

- [ ] `PRODUCTION_BASE_URL`
- [ ] `STAGING_DATABASE_SCHEMA`
- [ ] `STAGING_RATE_LIMIT_NAMESPACE`
- [ ] `CREDENTIAL_ROTATION_CONFIRMED`
- [ ] `HISTORY_REVIEW_CONFIRMED`
- [ ] `ROLLBACK_REHEARSAL_CONFIRMED`

Do **not** place `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEXTAUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_TOKEN`, or other provider runtime credentials in GitHub Actions.

Keep the three confirmation variables false until their receipts exist. Browser pass variables are intentionally unsupported; Chromium, Firefox, and WebKit classifications come only from generated Playwright evidence.

## 6. Run isolated staging acceptance

Dispatch `Phoenix Creator Studio Staging Acceptance` with:

- [ ] `staging_base_url`: exact HTTPS staging URL
- [ ] `expected_commit_sha`: exact deployed commit
- [ ] `rollback_commit_sha`: verified rollback commit
- [ ] `approval_phrase`: `RUN_ISOLATED_STAGING_ACCEPTANCE`

The workflow must pass environment policy, deployment identity, live Supabase and Upstash probes, Chromium/Firefox/WebKit acceptance, authenticated creator/recovery flow, cleanup, and deterministic evidence receipt.

## 7. Rehearse rollback

- [ ] Preserve immutable current and rollback deployment URLs.
- [ ] Confirm both deployments are still protected by the configured Vercel Automation Bypass.
- [ ] Dispatch `Phoenix Creator Studio Staging Rollback Rehearsal` with the required approval phrase.
- [ ] Confirm the staging alias moves to the rollback deployment and passes readiness.
- [ ] Confirm the alias returns to the current deployment and passes readiness.
- [ ] Review the rollback artifact.
- [ ] Set `ROLLBACK_REHEARSAL_CONFIRMED=true` only after the receipt passes.

## 8. Classification decision

- [ ] Retain the staging acceptance and rollback artifacts.
- [ ] Verify evidence digests and cleanup counts.
- [ ] Confirm all three browser receipts contain actual browser versions and screenshots.
- [ ] Record unresolved defects.
- [ ] Keep release-candidate status blocked unless staging, browser, rollback, credential, history, and hardware gates all pass.
