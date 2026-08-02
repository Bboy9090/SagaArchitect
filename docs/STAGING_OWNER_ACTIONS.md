# Staging Owner Action Checklist

These actions require access to external provider dashboards and cannot be completed by repository code alone.

## Security

- [ ] Rotate or revoke the historically exposed database credential.
- [ ] Confirm the old credential fails authentication.
- [ ] Complete Git-history and retained-artifact review.

## Supabase

- [ ] Create or confirm an isolated staging project.
- [ ] Create a private staging asset bucket.
- [ ] Obtain separate runtime-pooler and migration-safe database URLs.
- [ ] Add staging-only service-role credentials to Vercel secrets.

## Distributed rate limiting

- [ ] Create an isolated Upstash Redis staging database or equivalent supported backend.
- [ ] Add the staging endpoint and token to Vercel secrets.

## Vercel

- [ ] Connect `Bboy9090/SagaArchitect`.
- [ ] Create an isolated staging environment or staging project.
- [ ] Configure the staging environment variables from `docs/ENVIRONMENT_VARIABLES_STAGING.md`.
- [ ] Confirm the deployment never receives production credentials.

## Approval

- [ ] Record provider references without secret values.
- [ ] Approve the staging acceptance run.
- [ ] Approve any remote destructive verification only against isolated staging.
