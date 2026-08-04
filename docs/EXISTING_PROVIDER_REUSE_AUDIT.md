# Existing Provider Reuse Audit

## Purpose

Identify existing Supabase, Upstash/Redis, and Vercel resources across Bobby's repositories that may be repurposed for Phoenix Creator Studio staging without copying secret values into source control, issues, logs, or chat.

## Audit boundary

This audit inspected repository structure, deployment workflows, environment-variable usage, and committed configuration paths. It did **not** expose or copy secret values.

GitHub Actions and Environment secrets are write-only. Their values cannot be retrieved through the GitHub API. A repository may reference a secret name without proving that the secret currently exists, remains valid, or belongs to an unused provider resource.

Any credential committed in a repository or Git history must be treated as compromised and rotated before reuse.

## Supabase candidate

### `Bboy9090/dads-million-miles`

Evidence found:

- Supabase browser and server clients exist.
- Multiple scripts consume `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is referenced by client/server helpers.
- A tracked file exists at `public/env.local`.

Decision:

- The Supabase **account/project may be a reuse candidate** if the application is truly retired.
- Do not reuse a service-role key recovered from repository contents or history.
- Rotate Supabase API keys first.
- Confirm the old application is disconnected.
- Create a new private bucket dedicated to Phoenix Creator Studio staging.
- Use separate runtime-pooler and migration-safe database connections.
- Prefer a dedicated staging schema/database role, even when reusing the same Supabase project.

Required SagaArchitect secret mapping:

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_DATABASE_URL`
- `STAGING_DATABASE_MIGRATION_URL`
- variable: `STAGING_SUPABASE_STORAGE_BUCKET`

## Vercel candidate

### `Bboy9090/GhostWriter-`

Evidence found:

The deployment workflow references these GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Decision:

- The Vercel **account** is a reuse candidate.
- The secret values cannot be read or copied from GitHub.
- Rotate/create a Vercel token from the Vercel dashboard.
- Prefer creating a new Vercel project for SagaArchitect staging rather than silently repointing the old GhostWriter project.
- Reusing the old project is acceptable only after confirming its domains, environment variables, deployments, analytics, and integrations are no longer needed.

Required secret mapping:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Upstash / Redis audit

Findings:

- No repository match was found for `UPSTASH_REDIS_REST_URL`.
- No repository match was found for `UPSTASH_REDIS_REST_TOKEN`.
- No repository match was found for `QSTASH_TOKEN`.
- `Ultimate-SoulCodex` documents Upstash only as an optional future service.
- `Sonic_codex` contains generic `REDIS_URL` configuration and an env-like tracked file, but that does not prove the Redis instance is Upstash or safely reusable.

Decision:

- No evidence-backed Upstash credential candidate was found.
- Do not treat a generic committed `REDIS_URL` as a safe Upstash token.
- Use an existing Upstash account only through its dashboard, then rotate/create staging-scoped REST credentials.
- Create an isolated database or namespace for Phoenix Creator Studio staging.

Required SagaArchitect secret mapping:

- `STAGING_RATE_LIMIT_URL`
- `STAGING_RATE_LIMIT_TOKEN`

## Prohibited reuse paths

Do not:

- copy values from `.env`, `.env.local`, `.envo`, `.replit`, logs, build artifacts, or Git history
- commit provider keys to SagaArchitect
- paste secret values into an issue, pull request, or chat
- reuse a service-role key that has ever been committed
- point staging at an old production database without isolating data and migrations
- overwrite an old Vercel project before checking domains and integrations

## Approved reuse sequence

1. Confirm the old application/resource is retired.
2. Record the provider account and project reference without secret values.
3. Rotate/revoke old credentials.
4. Confirm the old credentials fail.
5. Create staging-scoped credentials.
6. Create isolated storage, database, and rate-limit namespaces.
7. Add new values directly to the protected GitHub Environment named `staging`.
8. Add matching values to the Vercel staging project.
9. Deploy an exact SagaArchitect commit.
10. Run the protected staging acceptance workflow.
11. Keep release-candidate status blocked until credential rotation and history review are recorded.

## Current conclusion

- Supabase resource candidate: `dads-million-miles`
- Vercel account/workflow candidate: `GhostWriter-`
- Upstash credential candidate: none proven
- Safe direct secret migration from repositories: not possible
- Safe provider-account/resource reuse after rotation: possible
