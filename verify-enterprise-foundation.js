const { rmSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const output = path.join(root, '.tmp-enterprise-tests');

function run(label, args) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', APP_ENV: 'test' },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

try {
  rmSync(output, { recursive: true, force: true });
  run('Compile focused TypeScript tests', [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p',
    'tsconfig.enterprise-tests.json',
  ]);
  run('Run focused enterprise foundation tests', [
    '--test',
    path.join(output, 'tests', 'enterprise-foundation.test.js'),
  ]);
  process.stdout.write('\nEnterprise Foundation Sprint 1 focused verification passed.\n');
} finally {
  rmSync(output, { recursive: true, force: true });
}
