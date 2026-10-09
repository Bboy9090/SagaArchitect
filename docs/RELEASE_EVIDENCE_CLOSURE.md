# Phoenix Creator Studio — Release Evidence Closure

This lane advances release evidence without inventing validation that has not occurred.

## Git-history credential audit

Run:

```bash
npm run audit:history-secrets
```

The scanner walks reachable Git blobs and detects credential-like material. It never writes recovered secret values into its report. Findings contain only:

- category
- SHA-256 fingerprint
- Git blob SHA
- path
- whether that exact blob/path is present in the current tree

The generated `history-secret-audit.json` distinguishes current-tree findings from historical-only findings.

A historical fingerprint is evidence for review and purge work; it is not evidence that the associated provider credential has been rotated or revoked.

The manual **Phoenix Creator Studio Release Evidence Preflight** workflow performs a full-history checkout and uploads this non-secret report.

## Physical-device preflight

Run on the actual device intended for hardware validation:

```bash
DEPLOYMENT_COMMIT_SHA=<exact-staging-sha> \
STAGING_BASE_URL=https://<isolated-staging-host> \
npm run test:hardware:preflight
```

The collector records hardware/OS/browser identity and determines whether the device is ready to execute the physical validation journey.

Its output format is deliberately:

`phoenix-creator-studio.hardware-preflight`

not:

`phoenix-creator-studio.hardware-evidence`

Therefore a preflight record cannot satisfy the hardware matrix or RC1 gate.

## Current release boundary

The remaining promotion sequence is still:

1. live isolated staging deployment
2. live Supabase and Upstash provider proof
3. Chromium, Firefox, and WebKit staging acceptance
4. recovery and cleanup proof
5. rollback rehearsal
6. physical hardware journey on all required classes
7. credential rotation/revocation and old-credential rejection proof
8. Git-history/retained-artifact review
9. RC1 assessment

No preflight artifact upgrades a capability classification by itself.
