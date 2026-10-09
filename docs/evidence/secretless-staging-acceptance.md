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
- Vercel Deployment Protection support is wired through an automation-bypass header, but the project-level bypass must still be provisioned by an authorized Vercel owner

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

Vercel project automation-bypass creation currently requires project-owner permission not available to the connected API identity. Until that bypass is configured, the GitHub browser runner cannot cross Vercel Preview Deployment Protection, so live browser classification remains blocked.

No production deployment or merge is authorized by this evidence file.
