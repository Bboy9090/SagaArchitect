# Enterprise Foundation Sprint 1 Evidence

Tracking issue: #17  
Working branch: `enterprise/foundation-sprint-1`  
Base branch: `main`

## Classification rules

A move may be classified as **implemented** only when:

1. A real code path exists.
2. Focused automated success and failure tests exist.
3. Lint passes.
4. Type checking passes.
5. The production build passes.
6. Existing authentication/ownership and canon-scanner regression gates pass.

No move in this sprint may be classified as integrated, emulator-validated, hardware-validated, or release candidate without separate evidence.

## Current sprint status

| Move | Capability | Current classification | Evidence status |
|---:|---|---|---|
| 1 | Typed production environment validator | Not yet classified | Code and focused tests added; CI pending |
| 2 | Production secret enforcement and redaction | Not yet classified | Code and focused tests added; CI pending |
| 3 | Bounded App Router body readers | Not yet classified | Registration, project creation, and upload paths connected; CI pending |
| 4 | Enterprise upload validator | Not yet classified | PNG/JPEG/WEBP signature validation and local cleanup path added; CI pending |
| 5 | Centralized safe API errors | Not yet classified | Stable typed response contract added to controlled routes; CI pending |
| 6 | Structured logging and correlation IDs | Not yet classified | Request wrapper and redacted JSON logger added to controlled routes; CI pending |

## Implementation checkpoint

Current code paths include:

- `src/lib/env-schema.ts`
- `src/lib/env-validator.ts`
- `src/lib/env.ts`
- `src/lib/redact-sensitive.ts`
- `src/lib/http/body-limits.ts`
- `src/lib/http/read-bounded-body.ts`
- `src/lib/uploads/upload-policy.ts`
- `src/lib/uploads/file-signatures.ts`
- `src/lib/uploads/storage-key.ts`
- `src/lib/uploads/validate-upload.ts`
- `src/lib/api-errors.ts`
- `src/lib/api-response.ts`
- `src/lib/request-context.ts`
- `src/lib/logger.ts`
- `src/lib/with-api-context.ts`
- `tests/enterprise-foundation.test.ts`
- `verify-enterprise-foundation.js`

Controlled route integrations:

- `src/app/api/auth/register/route.ts`
- `src/app/api/db/projects/route.ts`
- `src/app/api/db/assets/upload/route.ts`

## Required final regression commands

```bash
npm run lint
npm run typecheck
npm run build
npm run env:check
node verify-enterprise-foundation.js
node verify-auth-ownership.js
node verify-canon-scan.js
```

## Current blockers

- The repository lockfile was already internally inconsistent: its root metadata requested Next.js 16.1.7 while installed lock entries resolved 16.2.3. A temporary workflow is regenerating a deterministic lockfile before CI can reach lint, typecheck, build, and focused tests.
- No move is classified as implemented until the full evidence gate passes.

## Sprint boundary

This sprint does not claim durable production storage integration, distributed production rate limiting, emulator validation, hardware validation, staging acceptance, or release-candidate status.
