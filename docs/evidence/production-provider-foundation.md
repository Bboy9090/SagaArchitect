# Production Provider Foundation

Base commit: `c9ca2d51dbf13252cab48f362cd022b9566885e8`

This change closes the infrastructure gap that previously prevented a truthful production deployment.

## Implemented

- Supabase Storage adapter for authenticated save, read, existence, delete, and health-probe operations.
- Shared storage-key validation for local and remote providers.
- Upstash Redis REST adapter using one atomic Lua increment-and-expire operation.
- Fail-closed dependency handling with no memory fallback in production.
- HTTPS validation for Supabase and rate-limit endpoints.
- Production database lifecycle scripts and deployment documentation.

## Evidence gate

- `npm run secrets:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:enterprise`
- `npm run build`
- `npm audit --omit=dev`

Passing local tests prove request contracts and failure behavior with controlled provider responses. A deployed release still requires real Supabase, Upstash, PostgreSQL, migration, health, and upload/readback smoke evidence before the production-ready claim is promoted.
