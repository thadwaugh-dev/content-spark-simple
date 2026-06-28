import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fs.realpathSync.native(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
);

const nextBin = path.join(
  projectRoot,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    INIT_CWD: projectRoot,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);