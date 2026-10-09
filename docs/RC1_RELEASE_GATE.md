# Phoenix Creator Studio — RC1 Release-Candidate Gate

`RC1` means the declared release gates have passed. It does **not** mean the release is published or production traffic has been enabled.

## Hard blockers

RC1 remains blocked unless all of the following are true on one exact commit SHA:

- repository enterprise CI passes
- tracked-file secret scan passes
- dependency policy, SBOM, and high-severity audit pass
- isolated staging deployment is healthy
- live Supabase storage validation passes
- live Upstash validation passes
- Chromium `PCS-CHR-1440` passes
- Firefox `PCS-FF-1440` passes
- WebKit `PCS-WK-1440` passes
- complete creator vertical-slice acceptance passes
- asset-byte backup and transactional restore pass
- cleanup completes with no test users/projects/assets left behind
- rollback rehearsal passes
- exposed historical database credential is rotated/revoked
- old credential rejection is verified
- Git-history and retained-artifact review is complete
- all required physical hardware classes pass on the exact staged commit

## Required inputs

The RC assessment consumes:

- `staging-evidence-receipt.json`
- `hardware-matrix-assessment.json`
- `security-release-evidence.json`

`security-release-evidence.json` contains booleans and non-secret references only:

```json
{
  "credentialRotationConfirmed": true,
  "oldCredentialRejected": true,
  "historyReviewConfirmed": true,
  "rollbackRehearsalConfirmed": true,
  "rotationReceiptReference": "provider-side non-secret reference",
  "historyReviewReference": "issue or evidence-document reference"
}
```

Never record a credential value, connection string, cookie, token, or service-role key in this file.

## Deterministic assessment

Run:

```bash
npm run test:rc1:assessment
```

The command writes `rc1-assessment.json` and exits non-zero while any mandatory gate is missing.

## Freeze procedure after `RC1_ELIGIBLE`

1. record the exact commit SHA
2. stop feature merges into the candidate branch
3. generate final SBOM and dependency-policy artifacts
4. capture staging, browser, recovery, rollback, hardware, and security evidence digests
5. create the RC changelog and known-issues list
6. tag the exact candidate commit using the approved release process
7. perform no production deployment without explicit owner approval

## Publication boundary

An RC tag is validation state only. Production publication is a separate owner-approved change with its own deployment receipt and rollback target.
