export function suggestedHardwareClass(platform, arch) {
  if (platform === 'darwin' && arch === 'arm64') return 'macos-apple-silicon';
  if (platform === 'win32') return 'windows-desktop';
  return null;
}

export function buildHardwarePreflight({
  platform,
  arch,
  hostname,
  manufacturer,
  model,
  osName,
  osVersion,
  osBuild,
  browser,
  commitSha,
  stagingUrl,
  collectedAt = new Date().toISOString(),
}) {
  const hardwareClass = suggestedHardwareClass(platform, arch);
  const commitValid = /^[0-9a-f]{40}$/i.test(commitSha || '');
  let stagingUrlValid = false;
  try {
    stagingUrlValid = new URL(stagingUrl || '').protocol === 'https:';
  } catch {
    stagingUrlValid = false;
  }

  return {
    format: 'phoenix-creator-studio.hardware-preflight',
    version: 1,
    collectedAt,
    classification: 'preflight-only',
    hardwareValidated: false,
    hardwareClass,
    device: {
      hostname: hostname || null,
      manufacturer: manufacturer || null,
      model: model || null,
      platform,
      arch,
    },
    os: {
      name: osName || null,
      version: osVersion || null,
      build: osBuild || null,
    },
    browser: browser || null,
    commitSha: commitSha || null,
    stagingUrl: stagingUrl || null,
    readiness: {
      recognizedHardwareClass: Boolean(hardwareClass),
      identifiedDevice: Boolean(manufacturer && model),
      identifiedOs: Boolean(osName && osVersion),
      identifiedBrowser: Boolean(browser?.name && browser?.version),
      exactCommitProvided: commitValid,
      httpsStagingUrlProvided: stagingUrlValid,
    },
    eligibleForPhysicalValidation:
      Boolean(hardwareClass)
      && Boolean(manufacturer && model)
      && Boolean(osName && osVersion)
      && Boolean(browser?.name && browser?.version)
      && commitValid
      && stagingUrlValid,
    note: 'Preflight readiness only. This record cannot satisfy the hardware-validation or RC1 gate.',
  };
}
