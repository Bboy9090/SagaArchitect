import fs from 'node:fs';
import path from 'node:path';
import { assessHardwareMatrix } from './lib/release-evidence.mjs';

const directory = process.env.HARDWARE_EVIDENCE_DIR || 'artifacts/hardware';
const expectedCommit = process.env.DEPLOYMENT_COMMIT_SHA || null;
const receipts = [];

if (fs.existsSync(directory)) {
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.endsWith('.json')) continue;
    const filePath = path.join(directory, name);
    try {
      receipts.push(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      receipts.push({ invalidFile: name, parseError: error instanceof Error ? error.message : String(error) });
    }
  }
}

const assessment = {
  format: 'phoenix-creator-studio.hardware-matrix',
  version: 1,
  generatedAt: new Date().toISOString(),
  expectedCommit,
  receiptCount: receipts.length,
  ...assessHardwareMatrix(receipts, expectedCommit),
};

fs.writeFileSync('hardware-matrix-assessment.json', `${JSON.stringify(assessment, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(assessment, null, 2));
if (!assessment.allRequiredPassed) process.exitCode = 1;
