const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const {
  cleanupStaging,
  prepareStaging,
  readCleanTrackedFiles,
} = require('./prepare-discloud-staging');

function createFixture(baseDirectory = tmpdir()) {
  const root = mkdtempSync(path.join(baseDirectory, 'dta-stage-test-'));
  const project = path.join(root, 'project');
  const output = path.join(root, 'output');
  mkdirSync(path.join(project, 'src'), { recursive: true });
  mkdirSync(path.join(project, 'build'), { recursive: true });
  mkdirSync(path.join(project, 'panel', 'dist'), { recursive: true });
  mkdirSync(path.join(project, 'prisma', 'prisma'), { recursive: true });
  writeFileSync(path.join(project, 'src', 'index.ts'), 'export {};');
  writeFileSync(path.join(project, 'build', 'index.js'), '"use strict";');
  writeFileSync(path.join(project, 'panel', 'dist', 'index.html'), '<main>DTA</main>');
  writeFileSync(path.join(project, '.discloudignore'), '.env\n*.db\n');
  writeFileSync(path.join(project, 'discloud.config'), [
    'NAME=Dark Bot',
    'TYPE=site',
    'ID=dta-admin',
    'MAIN=build/index.js',
    'RAM=512',
  ].join('\n'));
  writeFileSync(path.join(project, '.env'), [
    `DISCORD_TOKEN=${'t'.repeat(60)}`,
    'CLIENT_ID=123456789012345678',
    'GUILD_ID=123456789012345678',
    'DATABASE_URL=file:./prisma/darkbot.db',
    'ADMIN_PANEL_ENABLED=true',
    `DISCORD_CLIENT_SECRET=${'s'.repeat(32)}`,
    'DISCORD_REDIRECT_URI=https://dta-admin.discloud.app/api/auth/callback',
    `PANEL_COOKIE_SECRET=${'c'.repeat(32)}`,
    `PANEL_ENCRYPTION_KEY=${Buffer.alloc(32, 1).toString('base64')}`,
    'PORT=8080',
    'NODE_ENV=production',
  ].join('\n'));
  writeFileSync(path.join(project, 'prisma', 'prisma', 'darkbot.db'), 'database');
  return { root, project, output };
}

test('accepts the long Windows form of the system temporary directory', t => {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    t.skip('Windows long temporary path is unavailable');
    return;
  }
  const fixture = createFixture(path.join(process.env.LOCALAPPDATA, 'Temp'));
  try {
    const result = prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    });

    assert.equal(result.outputDirectory, fixture.output);
    cleanupStaging({ projectRoot: fixture.project, outputDirectory: fixture.output });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('creates a staging directory with private runtime files and a safe ignore file', () => {
  const fixture = createFixture();
  try {
    const result = prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config', '.discloudignore'],
    });

    assert.equal(result.trackedFileCount, 2);
    assert.equal(readFileSync(path.join(fixture.output, 'src', 'index.ts'), 'utf8'), 'export {};');
    assert.equal(readFileSync(path.join(fixture.output, 'build', 'index.js'), 'utf8'), '"use strict";');
    assert.equal(readFileSync(path.join(fixture.output, 'panel', 'dist', 'index.html'), 'utf8'), '<main>DTA</main>');
    assert.equal(readFileSync(path.join(fixture.output, '.env'), 'utf8').includes('s'.repeat(32)), true);
    assert.equal(readFileSync(path.join(fixture.output, 'prisma', 'prisma', 'darkbot.db'), 'utf8'), 'database');
    const stagingIgnore = readFileSync(path.join(fixture.output, '.discloudignore'), 'utf8');
    assert.doesNotMatch(stagingIgnore, /^\.env$/m);
    assert.doesNotMatch(stagingIgnore, /^\*\.db$/m);
    assert.match(stagingIgnore, /^\.dta-discloud-staging$/m);
    cleanupStaging({ projectRoot: fixture.project, outputDirectory: fixture.output });
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('refuses an output path physically redirected into the repository', t => {
  const fixture = createFixture();
  try {
    const junction = path.join(fixture.root, 'junction');
    try {
      symlinkSync(fixture.project, junction, 'junction');
    } catch {
      t.skip('junction creation is unavailable');
      return;
    }
    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: path.join(junction, 'deploy'),
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    }), /outside the repository/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('refuses a junction inside generated build artifacts', t => {
  const fixture = createFixture();
  try {
    const junction = path.join(fixture.project, 'build', 'linked');
    try {
      symlinkSync(path.join(fixture.project, 'src'), junction, 'junction');
    } catch {
      t.skip('junction creation is unavailable');
      return;
    }
    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    }), /build artifact cannot be a symbolic link/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('refuses to clean an unmarked directory', () => {
  const fixture = createFixture();
  try {
    mkdirSync(fixture.output);
    assert.throws(() => cleanupStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
    }), /not a DTA staging directory/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('requires a clean Git working tree before collecting deploy files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'dta-stage-git-'));
  try {
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'DTA Test'], { cwd: root });
    writeFileSync(path.join(root, 'tracked.txt'), 'approved');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'test fixture'], { cwd: root });

    assert.deepEqual(readCleanTrackedFiles(root), ['tracked.txt']);
    writeFileSync(path.join(root, 'tracked.txt'), 'uncommitted');
    assert.throws(() => readCleanTrackedFiles(root), /working tree must be clean/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a tracked symbolic link even when its target is a regular file', t => {
  const fixture = createFixture();
  try {
    const linkPath = path.join(fixture.project, 'src', 'linked.ts');
    try {
      symlinkSync(path.join(fixture.project, 'src', 'index.ts'), linkPath, 'file');
    } catch {
      t.skip('symbolic link creation is unavailable');
      return;
    }

    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/linked.ts', 'discloud.config'],
    }), /symbolic link/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejects staging inside the repository', () => {
  const fixture = createFixture();
  try {
    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: path.join(fixture.project, 'deploy'),
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    }), /outside the repository/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejects bot hosting configuration and incomplete panel secrets', () => {
  const fixture = createFixture();
  try {
    writeFileSync(path.join(fixture.project, 'discloud.config'), 'TYPE=bot\nID=1785101572014\n');
    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    }), /TYPE=site/i);

    writeFileSync(path.join(fixture.project, 'discloud.config'), 'TYPE=site\nID=dta-admin\nRAM=512\n');
    writeFileSync(path.join(fixture.project, '.env'), 'DISCORD_TOKEN=token\n');
    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath: path.join(fixture.project, '.env'),
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    }), /missing environment variables/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejects placeholder Discord credentials', () => {
  const fixture = createFixture();
  try {
    const envPath = path.join(fixture.project, '.env');
    const environment = readFileSync(envPath, 'utf8').replace(/DISCORD_TOKEN=.*/, 'DISCORD_TOKEN=token');
    writeFileSync(envPath, environment);

    assert.throws(() => prepareStaging({
      projectRoot: fixture.project,
      outputDirectory: fixture.output,
      envPath,
      databasePath: path.join(fixture.project, 'prisma', 'prisma', 'darkbot.db'),
      trackedFiles: ['src/index.ts', 'discloud.config'],
    }), /DISCORD_TOKEN/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
