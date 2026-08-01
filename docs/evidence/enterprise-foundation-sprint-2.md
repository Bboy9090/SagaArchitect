# Enterprise Foundation Sprint 2 Evidence

Tracking issue: #19  
Working branch: `enterprise/foundation-sprint-2`  
Stacked base: `enterprise/foundation-sprint-1`

## Current classifications

| Move | Capability | Classification | Current evidence |
|---:|---|---|---|
| 7 | Security headers and CSP builder | Pending verification | Central builder connected through `next.config.ts`; focused tests added |
| 8 | Rate-limiter abstraction | Pending verification | Fail-closed store abstraction and registration connection added; focused tests added |
| 9 | Storage-provider contract | Pending verification | Contract and local adapter connected beneath compatibility driver; focused tests added |
| 10 | Idempotency framework | Not started | — |
| 11 | Optimistic concurrency | Not started | — |
| 12 | Feature flags and kill switches | Not started | — |
| 13 | Dependency, license, and SBOM gate | Not started | — |
| 14 | Data-lifecycle service | Not started | — |

## Sprint 2 code paths introduced

- `src/lib/security/security-headers.ts`
- `src/lib/rate-limit/types.ts`
- `src/lib/rate-limit/policies.ts`
- `src/lib/rate-limit/memory-store.ts`
- `src/lib/rate-limit/rate-limiter.ts`
- `src/lib/storage/storage-provider.ts`
- `src/lib/storage/local-storage-provider.ts`
- `src/lib/storage/index.ts`
- `tests/enterprise-foundation-sprint-2.test.ts`

## Initial integrations

- Global Next.js security headers and environment-aware CORS policy in `next.config.ts`
- Registration endpoint consumes the named registration rate-limit policy
- Existing local storage compatibility helpers delegate to the new provider contract
- Focused enterprise verification now runs both Sprint 1 and Sprint 2 test suites

## Honest limits

- The rate limiter intentionally rejects staging/production shared-provider configuration until a real distributed adapter is integrated.
- The storage selector intentionally rejects Supabase/S3 until a durable adapter is integrated.
- The CSP uses a compatibility-oriented inline-script allowance so the current Next.js application remains functional; nonce-based CSP remains a later hardening gate.
- Moves 10–14 are not yet started.
- No production, emulator, hardware, or release-candidate claim is made.
