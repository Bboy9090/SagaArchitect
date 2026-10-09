# Phoenix Creator Studio — Physical Hardware Validation Matrix

Hardware validation is an evidence classification, not a prediction. A device class becomes `hardware-validated` only after a real physical device completes the staging acceptance journey on the exact staged commit and produces a valid receipt.

## Required classes

| Hardware class | Minimum target | Required evidence |
|---|---|---|
| `windows-desktop` | Windows 11 PC/laptop | manufacturer/model, Windows version/build, browser/version, commit SHA, HTTPS staging URL, assertions, cleanup, timestamp |
| `macos-apple-silicon` | Apple Silicon Mac | exact Mac model, macOS version/build, browser/version, commit SHA, staging URL, assertions, cleanup, timestamp |
| `ios-ipados` | iPhone or iPad | exact model, iOS/iPadOS version/build, Safari/WebKit version evidence where available, commit SHA, staging URL, assertions, cleanup, timestamp |
| `android` | Android phone/tablet | manufacturer/model, Android version/build, browser/version, commit SHA, staging URL, assertions, cleanup, timestamp |
| `chromeos` | Chromebook/ChromeOS device | manufacturer/model, ChromeOS version/build, Chrome version, commit SHA, staging URL, assertions, cleanup, timestamp |

## Required physical journey

Every hardware receipt must cover at least:

1. load the HTTPS staging URL
2. register or sign in with the dedicated validation account
3. reopen an existing project
4. create or edit one project entity
5. upload and retrieve one private asset
6. run a canon scan
7. open a writing document
8. export or download a project artifact
9. sign out and sign back in
10. confirm the project and asset still exist
11. remove all hardware-run test data
12. record the test result and completion timestamp

## Receipt format

Create one JSON file per device under `artifacts/hardware/`. Do not include credentials, cookies, access tokens, database URLs, service-role keys, or private provider configuration.

```json
{
  "format": "phoenix-creator-studio.hardware-evidence",
  "version": 1,
  "hardwareClass": "windows-desktop",
  "device": {
    "manufacturer": "Example",
    "model": "Example Model"
  },
  "os": {
    "name": "Windows",
    "version": "11 24H2"
  },
  "browser": {
    "name": "Edge",
    "version": "000.0.0"
  },
  "commitSha": "40-character-staged-commit-sha",
  "stagingUrl": "https://staging.example.vercel.app",
  "result": "PASS",
  "cleanup": { "ok": true },
  "operator": "device-lab-operator",
  "completedAt": "2026-08-07T22:00:00.000Z",
  "assertions": [
    "authenticated session persisted",
    "private asset retrieved",
    "project reopened after sign-in"
  ],
  "secretValuesPresent": false
}
```

## Evaluation

Run:

```bash
DEPLOYMENT_COMMIT_SHA=<exact-staged-sha> npm run test:hardware:assessment
```

The generated `hardware-matrix-assessment.json` fails closed until all five required classes have at least one valid physical receipt for the exact staged commit.

A browser/emulator result is not a substitute for a hardware receipt, and a hardware receipt from a different commit does not carry forward automatically.
