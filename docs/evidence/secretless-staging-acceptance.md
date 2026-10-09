# Secretless Staging Acceptance Evidence

Tracking issue: #57  
Branch: `enterprise/secretless-staging-acceptance`

## Goal

Keep Supabase, Upstash, and PostgreSQL credentials inside the Vercel staging runtime while still allowing GitHub Actions to execute deterministic staging acceptance and cleanup.

## Repository changes

- staging automation requests require a dedicated bearer token and explicit staging/isolation/remote-test gates
- provider verification now executes inside the staging app against its configured database, Supabase storage, and Upstash backend
- provider evidence returned to the runner is sanitized and contains no provider credential values
- deterministic cleanup executes inside staging and is restricted to generated `pcs-*` `@example.test` identities
- cleanup removes durable asset objects before cascading test-user records
- browser and creator-journey harnesses no longer import PostgreSQL or receive migration credentials
- GitHub staging acceptance no longer receives Supabase service-role, Upstash, database, or Auth.js secrets
- Vercel Deployment Protection support uses a short-lived shareable-link bypass query; the stronger project-level automation bypass remains unavailable to the connected Vercel API identity

## Local verification checkpoint

- tracked-file secret scan: PASS
- production dependency audit: PASS
- lint: PASS
- typecheck: PASS
- focused enterprise tests: 84/84 PASS
- release-foundation tests: 8/8 PASS
- production build: PASS

## External boundary

The staging automation token has been generated and stored only in the protected GitHub `staging` environment and the Vercel `staging` branch Preview environment. Its value is not committed or recorded here.

The project-level automation bypass requires project-owner permission not available to the connected API identity. A seven-day shareable-link bypass has been created instead and stored only as a protected GitHub staging secret; this is sufficient for the current acceptance window but is intentionally temporary.

No production deployment or merge is authorized by this evidence file.
