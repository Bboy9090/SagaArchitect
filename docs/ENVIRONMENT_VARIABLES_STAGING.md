# Staging Environment Variable Contract

Phoenix Creator Studio staging must be isolated from production and must fail closed when required dependencies are missing.

## Application

- `APP_ENV=staging`
- `NODE_ENV=production`
- `NEXTAUTH_URL=https://<staging-host>`
- `NEXTAUTH_SECRET=<unique staging secret of at least 32 characters>`
- `LOG_LEVEL=info`

## Database

- `DATABASE_URL=<serverless runtime pooler connection>`
- `DATABASE_MIGRATION_URL=<migration-safe direct connection>`
- `DATABASE_SCHEMA=phoenix_staging` (or another dedicated non-`public` schema)
- `RUN_STAGING_MIGRATIONS=true` only for the reviewed staging deployment build

The runtime and migration URLs may reuse an approved retired provider account, but staging must use a dedicated non-`public` schema. Runtime connections set PostgreSQL `search_path` to that schema. Migrations run during the explicitly enabled staging deployment build, never from requests or readiness probes.

## Storage

- `STORAGE_PROVIDER=supabase` or another implemented durable provider
- `SUPABASE_URL=<staging project URL>`
- `SUPABASE_SERVICE_ROLE_KEY=<server-only staging service role>`
- `SUPABASE_STORAGE_BUCKET=<private staging bucket>`

`STORAGE_PROVIDER=local` is forbidden in staging.

## Rate limiting

- `RATE_LIMIT_PROVIDER=upstash` or another implemented shared backend
- `RATE_LIMIT_URL=<staging shared-store endpoint>`
- `RATE_LIMIT_TOKEN=<server-only staging token>`
- `RATE_LIMIT_NAMESPACE=pcs:staging:phoenix` (or another staging-specific namespace)

`RATE_LIMIT_PROVIDER=memory` is forbidden in staging. A dedicated namespace is required even when an existing Upstash database is reused, so staging counters cannot collide with production counters.

## Testing

- `TEST_BASE_URL=<explicit staging URL>`
- `ALLOW_REMOTE_TESTS=true` only for a reviewed, isolated staging acceptance run

The following must never be enabled in staging:

- `ENABLE_TEST_AUTH_BYPASS=true`

## Optional integrations

- `OPENAI_API_KEY=<staging-scoped key>`
- `RAINSTORMS_BASE_URL=<reviewed staging endpoint>`

Optional integrations must be reported as degraded rather than silently assumed healthy.

## Validation

Before deployment, run the production-like environment validator with staging values. The validation output may include variable names and provider identities, but never secret values.
