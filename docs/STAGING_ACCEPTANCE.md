# Phoenix Creator Studio — Staging Acceptance Contract

## Purpose

Staging is the first production-like environment. It must use the same runtime architecture intended for production while remaining isolated from real production data.

## Required staging services

- Vercel-hosted Next.js application
- Supabase PostgreSQL runtime connection through a serverless-compatible pooler
- Separate migration-safe PostgreSQL connection
- Private durable object storage
- Shared distributed rate-limit backend
- HTTPS-only Auth.js configuration
- Environment validation in `staging` mode

## Forbidden staging shortcuts

- local filesystem asset persistence
- memory-only rate limiting
- development authentication secrets
- production database or production storage buckets
- test-authentication bypass
- destructive verification without explicit staging-safe configuration

## Deployment order

1. Validate staging environment configuration.
2. Apply schema migrations once using the migration connection.
3. Build the exact commit to be deployed.
4. Deploy the application.
5. Verify `/api/health/ready`.
6. Run the staging acceptance suite against the explicit staging URL.
7. Record commit SHA, deployment URL, database project identifier, storage bucket, rate-limit provider, test run, cleanup result, and rollback target.

## Acceptance journey

The automated staging suite must prove:

1. registration and sign-in
2. authenticated session persistence
3. project creation and optimistic concurrency
4. character, faction, location, lore, scene, and storyboard creation
5. private asset upload, retrieval, and deletion
6. canon scan execution and a deterministic finding
7. writing-template creation and persistence
8. JSON and PDF/production-packet export
9. deterministic project backup including asset bytes
10. restore preflight and isolated transactional restore
11. sign-out and unauthorized rejection
12. second-session reopen with no lost project structure or media
13. cleanup of all test data

## Required browser configurations

- `PCS-CHR-1440`: Playwright Chromium, 1440×900
- `PCS-FF-1440`: Playwright Firefox, 1440×900
- `PCS-WK-1440`: Playwright WebKit, 1440×900

Passing one browser does not qualify the suite as emulator-validated across all three configurations.

## Failure policy

Any failed acceptance step blocks release-candidate status. Cleanup failures are release-blocking because they indicate incomplete lifecycle control.

## Evidence record

The staging evidence receipt must include:

- exact commit SHA
- deployment identifier and URL
- migration result
- readiness result
- browser configuration
- test timestamps
- request/correlation IDs for failures
- backup integrity hash
- restore receipt
- cleanup receipt
- rollback target
- unresolved defects
