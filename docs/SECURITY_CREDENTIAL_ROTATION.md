# Security Credential Rotation and History Purge Gate

## Status

A database credential was previously committed inside verification scripts. The current repository no longer uses embedded credentials, but the historical value must be treated as compromised until the owner confirms rotation or revocation.

## Required owner actions

1. Revoke or rotate the exposed database credential at the database provider.
2. Replace runtime and migration credentials in local, CI, staging, and production secret stores.
3. Invalidate active sessions or access paths tied to the old credential where supported.
4. Confirm the old credential no longer authenticates.
5. Review Git history, pull-request patches, workflow logs, and retained artifacts for the value.
6. Purge the value from Git history using an approved history-rewrite procedure.
7. Coordinate repository re-cloning or history reconciliation after the rewrite.
8. Record the rotation timestamp, provider-side revocation receipt, history rewrite commit, and verification result without recording secret values.

## Release rule

Staging may be prepared while rotation is in progress, but it must not receive the compromised credential. Phoenix Creator Studio may not be declared a release candidate until rotation/revocation and history-purge review are recorded as complete.

## Evidence fields

- provider
- credential category
- rotated or revoked timestamp
- non-secret receipt/reference
- Git history rewrite method
- affected branches/tags reviewed
- retained artifacts reviewed
- verification that the old credential fails
- operator and approval record

Never place credential values, connection strings, passwords, tokens, or service-role keys in this document.
