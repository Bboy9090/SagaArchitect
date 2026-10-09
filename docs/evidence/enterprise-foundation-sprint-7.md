# Enterprise Foundation Sprint 7 Evidence

Tracking issue: #51  
Draft pull request: #52  
Branch: `enterprise/release-candidate-foundation`  
Base: `4fa6fd16e86991a0410b595e3668e6fedc67d150`

## Goal

Build the final repository-side evidence lane needed after live staging: physical hardware validation receipts and a deterministic RC1 decision.

## Implemented repository paths

- `scripts/lib/release-evidence.mjs`
- `scripts/generate-hardware-assessment.mjs`
- `scripts/generate-rc1-assessment.mjs`
- `tests/release-candidate-foundation.test.mjs`
- `docs/HARDWARE_VALIDATION_MATRIX.md`
- `docs/RC1_RELEASE_GATE.md`
- enterprise CI enforces `npm run test:release-foundation`
- Vercel prebuild executes the release-foundation tests before the Next.js build

## Classification boundary

The evidence machinery may be classified as implemented after focused tests and the full repository gate pass. Physical hardware itself remains **not validated** until real receipts exist for every required class on the exact staged commit. RC1 remains **blocked** until staging, browser, provider, recovery, rollback, security, and hardware evidence all pass.

## Live provider status discovered during this sprint

The Vercel GitHub integration created preview deployments for PR #52 and reported project `saga-architect` with project ID `prj_wfipp1Nv18kLfiKU6QYkagYduFjv`.

This preview is **not** equivalent to the protected staging acceptance environment because isolated Supabase, Upstash, migration, security, and rollback evidence is not yet proven.

## Current validation refresh

The prior GitHub Actions runs are outside GitHub's rerun window. A current branch commit is used to trigger a fresh repository gate and a fresh Vercel prebuild instead of bypassing required checks.

The Vercel prebuild is a secondary signal only. A GitHub enterprise gate remains required before merge.

## Current external blockers

- live isolated Supabase validation
- live isolated Upstash validation
- protected staging acceptance
- Chromium / Firefox / WebKit staging evidence
- rollback rehearsal
- historical credential rotation and old-credential rejection
- Git-history / retained-artifact review
- physical-device receipts for all required hardware classes

## Merge rule

Do not merge PR #52 unless the fresh enterprise gate completes successfully. Do not claim hardware validation or RC1 from this PR alone. Production publication remains separately owner-approved.
