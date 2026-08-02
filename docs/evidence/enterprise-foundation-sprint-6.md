# Enterprise Foundation Sprint 6 Evidence

Tracking issue: #45  
Working branch: `enterprise/foundation-sprint-6`  
Base merge commit: `f2f9248157610f48eb0188f0b6187874f40170f1`

## Goal

Prepare and execute the first live, isolated staging acceptance lane without confusing repository readiness with live-service, browser, hardware, or release-candidate evidence.

## Scope

26. Live staging orchestration and fail-closed approval gates
27. Live Supabase Storage and Upstash dependency verification
28. Production-like Auth.js cookie and session hardening
29. Authenticated staging API vertical-slice runner
30. Named browser acceptance harness
31. Recovery, cleanup, and rollback evidence capture
32. Release-readiness decision record

## Current classifications

| Move | Capability | Classification | Evidence |
|---:|---|---|---|
| 26 | Staging orchestration | Not yet classified | — |
| 27 | Live provider verification | Not yet classified | — |
| 28 | Production-like auth hardening | Not yet classified | — |
| 29 | Staging API vertical slice | Not yet classified | — |
| 30 | Browser acceptance | Not yet classified | — |
| 31 | Staging recovery and rollback | Not yet classified | — |
| 32 | Release-readiness decision | Not yet classified | — |

## Non-negotiable evidence rules

- A workflow definition is not a staging pass.
- Mocked or local providers are not live Supabase or Upstash validation.
- An HTTP/API acceptance run is not browser emulator validation.
- A Chromium pass does not imply Firefox or WebKit passed.
- A browser emulator pass is not physical-hardware validation.
- Release-candidate status remains blocked until declared gates, cleanup, rollback, credential rotation, and history review all pass.

## Owner-controlled blockers

- rotate or revoke the historically exposed database credential
- prove the old credential no longer authenticates
- complete Git-history and retained-artifact review
- configure isolated Vercel, Supabase, and Upstash staging resources
- store staging-only secrets in protected provider/GitHub environments

No secret values belong in this ledger.
