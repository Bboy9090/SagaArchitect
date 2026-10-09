# Phoenix Creator Studio — Production Deployment Policy

Automatic Vercel deployments from the Git branch `main` are disabled in `vercel.json`.

## Why

Repository merges and production publication are separate decisions.

A merge can advance verified code, evidence gates, documentation, or staging infrastructure without silently creating a new production deployment.

The dedicated `staging` branch remains enabled for Vercel Git deployments so live validation can continue.

## Production publication rule

A production deployment is allowed only after:

1. the exact candidate commit is classified `RC1_ELIGIBLE`;
2. live Supabase and Upstash staging validation passed;
3. Chromium, Firefox, and WebKit staging acceptance passed;
4. backup/restore and cleanup evidence passed;
5. rollback rehearsal passed;
6. credential rotation/revocation and history review are confirmed;
7. required physical hardware receipts passed on the exact candidate commit;
8. the owner explicitly approves production publication.

Production publication must then use an explicit Vercel production deployment command/API action against the approved commit, rather than an automatic merge-side effect.

## Repository enforcement

`tests/release-candidate-foundation.test.mjs` fails if:

- automatic `main` Git deployments are enabled, or
- the `staging` branch is disabled.

Changing this policy requires an intentional reviewed repository change.

## Current boundary

This policy does not publish production. It only prevents unintentional production deployment from future merges.
