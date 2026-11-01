# Foundation database executor

The foundation workflow runs on `ubuntu-24.04` and uses the runner-provided PostgreSQL 16 service on loopback. The previous `public.ecr.aws/docker/library/postgres:16-alpine` service could fail before checkout because the registry denied its image pull.

The workflow checks out the full candidate SHA, verifies `HEAD` and a clean tracked tree, starts PostgreSQL, creates a fresh test database, checks the actual server is major version 16, and records source identity and database version with the existing evidence artifacts. The CI-only database credential is a public disposable fixture. No production or staging service is contacted.

All schema, migration, enterprise, ownership, restore, canon, build, dependency, secret, and release-evidence gates remain enforced. A database startup failure blocks the final gate. The service is stopped in cleanup. This executor change does not qualify live staging providers or physical devices.

Runner package reference: https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md#postgresql
