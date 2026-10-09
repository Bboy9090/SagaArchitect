import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { buildHardwarePreflight } from './lib/hardware-preflight.mjs';

function command(file, args = []) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function macHardware() {
  const hardware = command('/usr/sbin/system_profiler', ['SPHardwareDataType']);
  const model = hardware.match(/Model Name:\s*(.+)/)?.[1]?.trim()
    || hardware.match(/Model Identifier:\s*(.+)/)?.[1]?.trim()
    || '';
  const chip = hardware.match(/Chip:\s*(.+)/)?.[1]?.trim() || '';
  return {
    manufacturer: 'Apple',
    model: model || chip || 'Apple Silicon Mac',
    osName: 'macOS',
    osVersion: command('/usr/bin/sw_vers', ['-productVersion']) || os.release(),
    osBuild: command('/usr/bin/sw_vers', ['-buildVersion']) || null,
  };
}

function windowsHardware() {
  const ps = (script) => command('powershell.exe', ['-NoProfile', '-Command', script]);
  return {
    manufacturer: ps('(Get-CimInstance Win32_ComputerSystem).Manufacturer') || process.env.HARDWARE_MANUFACTURER || '',
    model: ps('(Get-CimInstance Win32_ComputerSystem).Model') || process.env.HARDWARE_MODEL || '',
    osName: 'Windows',
    osVersion: ps('(Get-CimInstance Win32_OperatingSystem).Caption') || os.release(),
    osBuild: ps('(Get-CimInstance Win32_OperatingSystem).BuildNumber') || null,
  };
}

function browserEvidence() {
  if (process.env.HARDWARE_BROWSER_NAME && process.env.HARDWARE_BROWSER_VERSION) {
    return { name: process.env.HARDWARE_BROWSER_NAME, version: process.env.HARDWARE_BROWSER_VERSION };
  }

  const candidates = process.platform === 'darwin'
    ? [
        ['Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--version']],
        ['Microsoft Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', ['--version']],
      ]
    : process.platform === 'win32'
      ? [
          ['Microsoft Edge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--version']],
          ['Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--version']],
        ]
      : [];

  for (const [name, executable, args] of candidates) {
    const output = command(executable, args);
    if (output) return { name, version: output.replace(/^.*?([0-9]+(?:\.[0-9]+){1,3}).*$/, '$1') };
  }
  return null;
}

const platform = process.platform;
const hardware = platform === 'darwin'
  ? macHardware()
  : platform === 'win32'
    ? windowsHardware()
    : {
        manufacturer: process.env.HARDWARE_MANUFACTURER || '',
        model: process.env.HARDWARE_MODEL || '',
        osName: os.type(),
        osVersion: os.release(),
        osBuild: null,
      };

const receipt = buildHardwarePreflight({
  platform,
  arch: process.arch,
  hostname: os.hostname(),
  ...hardware,
  browser: browserEvidence(),
  commitSha: process.env.DEPLOYMENT_COMMIT_SHA || null,
  stagingUrl: process.env.STAGING_BASE_URL || null,
});

const output = process.env.HARDWARE_PREFLIGHT_OUTPUT || 'hardware-preflight.json';
fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(receipt, null, 2));

if (!receipt.eligibleForPhysicalValidation) process.exitCode = 2;
