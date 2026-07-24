# Enterprise Foundation Sprint 1 Evidence

Tracking issue: #17  
Draft pull request: #18  
Working branch: `enterprise/foundation-sprint-1`  
Base branch: `main`

## Classification rules

A move may be classified as **implemented** only when:

1. A real code path exists.
2. Focused automated success and failure tests exist.
3. Lint passes.
4. Type checking passes.
5. The production build passes.
6. Existing authentication/ownership, canon-scanner, and history-restore regression gates pass against an isolated database.

No move in this sprint is classified as integrated, emulator-validated, hardware-validated, or release candidate. Controlled route connections are documented below, but repository-wide integration remains a later gate.

## Final sprint classification

| Move | Capability | Classification | Evidence |
|---:|---|---|---|
| 1 | Typed production environment validator | **Implemented** | Typed runtime/deployment validation plus focused development, test, staging, and production policy tests |
| 2 | Production secret enforcement and redaction | **Implemented** | Production auth-secret enforcement, recursive log redaction, tracked-file secret scan, and isolated test-only auth bypass controls |
| 3 | Bounded App Router body readers | **Implemented** | Declared and streamed byte limits, JSON/text/multipart/base64 readers, typed 400/413/415 behavior, and focused boundary tests |
| 4 | Enterprise upload validator | **Implemented** | PNG/JPEG/WEBP allowlist, extension/MIME/signature checks, generated keys, path containment, and rollback cleanup tests/code paths |
| 5 | Centralized safe API errors | **Implemented** | Typed errors, normalized legacy status mapping, stable response contract, sanitized internal failures, and request IDs |
| 6 | Structured logging and correlation IDs | **Implemented** | Validated correlation IDs, structured JSON logs, automatic redaction, log-injection protection, and request timing wrapper |

## Code paths

### Environment and secrets

- `src/lib/env-schema.ts`
- `src/lib/env-validator.ts`
- `src/lib/env.ts`
- `src/lib/redact-sensitive.ts`
- `scripts/check-env.mjs`
- `scripts/check-secrets.mjs`
- `.env.example`

### Request and upload safety

- `src/lib/http/body-limits.ts`
- `src/lib/http/read-bounded-body.ts`
- `src/lib/uploads/upload-policy.ts`
- `src/lib/uploads/file-signatures.ts`
- `src/lib/uploads/storage-key.ts`
- `src/lib/uploads/validate-upload.ts`
- `src/lib/storage-driver.ts`

### Errors, logging, and request context

- `src/lib/api-errors.ts`
- `src/lib/api-response.ts`
- `src/lib/request-context.ts`
- `src/lib/logger.ts`
- `src/lib/with-api-context.ts`

### Focused verification

- `tests/enterprise-foundation.test.ts`
- `tsconfig.enterprise-tests.json`
- `verify-enterprise-foundation.js`
- `verify-auth-ownership.js`
- `verify-canon-scan.js`
- `verify-history-restore.js`

## Controlled route connections

The new foundations are connected to a controlled initial route set:

- `src/app/api/auth/register/route.ts`
- `src/app/api/db/projects/route.ts`
- `src/app/api/db/assets/upload/route.ts`
- `src/app/api/migration/preview/route.ts`
- `src/app/api/migration/import/route.ts`

Authentication and version-history hardening also changed:

- `src/lib/auth-options.ts`
- `src/lib/auth-helpers.ts`
- `src/lib/version-history.ts`
- project, character, scene, storyboard, asset, and history-restore mutation routes

## Security findings remediated during the sprint

1. A test-session request header was accepted outside an isolated test environment. It is now ignored unless both `APP_ENV=test` and `ENABLE_TEST_AUTH_BYPASS=true`; environment validation rejects bypass enablement elsewhere.
2. Verification scripts contained a tracked database credential. Current files now require injected test database configuration and refuse remote destructive runs by default.
3. One direct character-deletion endpoint lacked ownership authorization. It now verifies the authenticated owner through the parent project.
4. Version-history rows used a fixed placeholder user. All logging callers now supply the authenticated user ID.
5. History restoration could reassign ownership through legacy snapshot data. Restored projects/assets now retain the authenticated owner and current owned project.
6. Asset deletion logs no longer expose physical filesystem paths.

## Passing CI evidence

Workflow: `Fan-Favorite Foundation`  
Run ID: `30104956198`  
Run number: `76`  
Evidence commit: `07f057b24626c26730c11bed26fb37d78fddd7f6`  
Artifact: `phoenix-creator-studio-foundation` (`8601208193`)  
Artifact digest: `sha256:077ae40783204f0d41824466069948dd1bcb83fe8b33200aff727833d1c64beb`

All enforced steps passed:

- locked dependency installation
- tracked-file secret scan
- isolated PostgreSQL schema application
- ESLint
- TypeScript typecheck
- environment policy validation
- focused enterprise foundation tests
- Next.js production build
- isolated application startup and database health probe
- authentication and ownership regression suite
- deterministic canon scanner regression suite
- history restore and JSON export regression suite
- repository smoke contract
- final evidence gate

## Commands represented by the gate

```bash
npm ci
npm run secrets:check
npx drizzle-kit push --force
npm run lint
npm run typecheck
npm run env:check
npm run test:enterprise
npm run build
npm run start
node verify-auth-ownership.js
node verify-canon-scan.js
node verify-history-restore.js
npm run test:smoke
```

## Remaining risks and next gates

- The removed database credential remains present in Git history until history is purged. It must be rotated immediately and treated as compromised.
- Bounded request readers, safe error responses, and request-context logging are not yet connected to every API route.
- Local filesystem assets remain development/test-only and are not durable production storage.
- Memory-only rate limiting remains development/test-only; no distributed production limiter is connected yet.
- No staging deployment, emulator validation, physical-hardware validation, backup/restore drill, soak test, or release-candidate declaration has been completed.
- Next.js reports a deprecated middleware convention and a PDF-export tracing warning; both require later production-readiness work.

## Sprint boundary

This sprint establishes evidence-backed **implemented** foundations only. Repository-wide integration, production services, staging acceptance, emulator and hardware matrices, and release-candidate gates remain separate work.
