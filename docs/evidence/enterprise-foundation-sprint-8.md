# Enterprise Foundation Sprint 8 Evidence

Tracking issue: #54  
Branch: `enterprise/staging-isolation-sprint-8`  
Base: `88873d987b9eefa7b837979bae43073f5fa58206`

## Goal

Make the existing provider-reuse path genuinely isolated for staging without copying provider secret values into source control or chat.

## Implemented in this branch

- dedicated `DATABASE_SCHEMA` support for runtime PostgreSQL `search_path`
- staging deployment policy requires a safe non-`public` schema
- `DATABASE_MIGRATION_URL` is preferred by Drizzle CLI configuration
- explicit build/deployment migration script creates the staging schema and runs Drizzle migrations there
- migration script is inert unless `APP_ENV=staging`, `RUN_STAGING_MIGRATIONS=true`, and `STAGING_CONFIRM_ISOLATED=true`
- dedicated `RATE_LIMIT_NAMESPACE` support is propagated into the Upstash adapter
- staging deployment policy rejects the default/production rate-limit namespace
- deployment identity exposes only the non-secret schema and rate-limit namespace for acceptance evidence
- staging acceptance workflow verifies those namespaces on the exact deployed app
- CI exercises the migration script against an isolated PostgreSQL service schema

## Classification boundary

This work can earn `implemented` / repository-integrated classification after the full enterprise gate passes. It does not by itself prove live Supabase, live Upstash, browser acceptance, rollback, hardware, or RC1.
