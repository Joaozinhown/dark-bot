const { rmSync } = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const buildDirectory = path.resolve(projectRoot, 'build');

if (path.dirname(buildDirectory) !== projectRoot || path.basename(buildDirectory) !== 'build') {
  throw new Error('Refusing to clean an unexpected build directory.');
}

// ponytail: native cleanup prevents stale deploy artifacts without another dependency.
rmSync(buildDirectory, { recursive: true, force: true });
