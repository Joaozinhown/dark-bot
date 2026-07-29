const { createHash } = require('node:crypto');
const {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { cleanupStaging } = require('./prepare-discloud-staging');

const SOURCE_APP = 'dta-admin';
const TARGET_APP = 'admin-dta-bot';
const LEGACY_APP = '1785101572014';
const TARGET_REDIRECT_URI = `https://${TARGET_APP}.discloud.app/api/auth/callback`;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const HTTP_TIMEOUT_MS = 10_000;
const COMMAND_TIMEOUT_MS = 180_000;
const EXPECTED_COMMAND_COUNT = 11;

async function runCutover(dependencies) {
  await dependencies.assertPreflight();

  let sourceStopped = false;
  let targetUploadAttempted = false;
  let stagingDirectory;
  try {
    sourceStopped = true;
    await dependencies.stopSource();
    const databasePath = await dependencies.backupSource();
    stagingDirectory = await dependencies.prepareStaging(databasePath);
    targetUploadAttempted = true;
    await dependencies.uploadTarget(stagingDirectory);
    await dependencies.waitTargetReady();
    await dependencies.assertFinalState();
  } catch (error) {
    if (sourceStopped) {
      const targetState = await dependencies.getTargetState();
      if (targetState === 'online' || (targetUploadAttempted && targetState === 'offline')) {
        await dependencies.stopTarget();
        await dependencies.backupTargetForRecovery();
      } else if (targetUploadAttempted && targetState === 'missing') {
        throw new Error('Rollback aborted because target creation may still be pending. Source remains offline.', { cause: error });
      } else if (targetState !== 'offline' && targetState !== 'missing') {
        throw new Error('Rollback aborted because target state is unknown. Source remains offline.', { cause: error });
      }
      await dependencies.assertRollbackSafe();
      const sourceState = await dependencies.getSourceState();
      if (sourceState === 'offline') {
        await dependencies.startSource();
      } else if (sourceState !== 'online') {
        throw new Error('Rollback aborted because source state is unknown.', { cause: error });
      }
    }
    throw error;
  } finally {
    if (stagingDirectory) await dependencies.cleanupStaging(stagingDirectory);
  }
}

function findWindowsDiscloudEntrypoint() {
  const result = spawnSync('where.exe', ['discloud.cmd'], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  const shimPath = result.stdout?.split(/\r?\n/).find(Boolean);
  if (result.status !== 0 || !shimPath) throw new Error('discloud.cmd was not found in PATH.');
  const cliPath = path.win32.join(
    path.win32.dirname(shimPath.trim()),
    'node_modules',
    'discloud-cli',
    'bin',
    'discloud',
  );
  if (!existsSync(cliPath)) throw new Error(`Discloud CLI entrypoint was not found: ${cliPath}`);
  return cliPath;
}

function buildSpawnInvocation(
  command,
  args,
  platform = process.platform,
  resolveDiscloudEntrypoint = findWindowsDiscloudEntrypoint,
) {
  if (platform === 'win32' && command === 'discloud') {
    return {
      command: process.execPath,
      args: [resolveDiscloudEntrypoint(), ...args],
    };
  }
  return { command, args };
}

function runCommand(command, args, options = {}) {
  const invocation = buildSpawnInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? PROJECT_ROOT,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    timeout: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}. ${output.trim()}`);
  }
  return { output, status: result.status ?? 1 };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAppState(app, exitCode, output) {
  const match = output.match(new RegExp(`^\\s*${escapeRegex(app)}\\s+(Online|Offline)\\b`, 'im'));
  if (match) return match[1].toLowerCase();
  if (exitCode !== 0 && /(Discloud API:\s*404|not found)/i.test(output)) return 'missing';
  return 'unknown';
}

function getAppState(app) {
  const result = runCommand('discloud', ['app', 'status', app], { allowFailure: true });
  return parseAppState(app, result.status, result.output);
}

async function waitForAppState(app, expectedState, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const state = getAppState(app);
    if (state === expectedState) return;
    if (state === 'unknown') throw new Error(`Unable to determine ${app} state.`);
    await new Promise(resolve => setTimeout(resolve, 3_000));
  } while (Date.now() < deadline);
  throw new Error(`${app} did not become ${expectedState} within the timeout.`);
}

function parseKeyValueFile(contents) {
  return new Map(contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const separator = line.indexOf('=');
      return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

async function assertCallbackRegistered(environment) {
  const response = await fetch('https://discord.com/api/v10/applications/@me', {
    headers: { Authorization: `Bot ${environment.DISCORD_TOKEN}` },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Discord application lookup failed with HTTP ${response.status}.`);
  const application = await response.json();
  const redirects = Array.isArray(application.redirect_uris) ? application.redirect_uris : [];
  if (!redirects.includes(TARGET_REDIRECT_URI)) {
    throw new Error(`Discord OAuth callback is missing: ${TARGET_REDIRECT_URI}`);
  }
}

function findFiles(root, predicate) {
  const matches = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) matches.push(...findFiles(entryPath, predicate));
    else if (entry.isFile() && predicate(entryPath)) matches.push(entryPath);
  }
  return matches;
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function verifyDatabase(databasePath) {
  const { DatabaseSync } = require('node:sqlite');
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const result = database.prepare('PRAGMA integrity_check').get();
    if (result.integrity_check !== 'ok') throw new Error('Discloud SQLite backup failed integrity_check.');
  } finally {
    database.close();
  }
}

function isTargetHealthReady(body) {
  return body?.data?.botReady === true
    && body?.data?.commandCount === EXPECTED_COMMAND_COUNT;
}

function extractArchive(archivePath, destinationPath) {
  mkdirSync(destinationPath, { recursive: false });
  const command = [
    "$ErrorActionPreference='Stop'",
    'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1]',
  ].join('; ');
  runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command, archivePath, destinationPath]);
}

function downloadBackupArchive(app, label) {
  const stamp = Math.floor(Date.now() / 1000);
  const relativeRoot = path.join('discloud', 'backups', `${label}-${stamp}`);
  const backupRoot = path.join(PROJECT_ROOT, relativeRoot);
  mkdirSync(backupRoot, { recursive: true });
  runCommand('discloud', ['app', 'backup', app, relativeRoot, '--save'], { inherit: true });
  const archives = findFiles(backupRoot, filePath => filePath.toLowerCase().endsWith('.zip'));
  if (archives.length !== 1) throw new Error(`${app} backup must contain exactly one ZIP archive.`);
  return { archivePath: archives[0], backupRoot };
}

function downloadAndVerifyDatabase(app, label) {
  const { archivePath, backupRoot } = downloadBackupArchive(app, label);
  const extractionRoot = path.join(backupRoot, 'extracted');
  extractArchive(archivePath, extractionRoot);
  const databases = findFiles(extractionRoot, filePath => path.basename(filePath) === 'darkbot.db');
  if (databases.length !== 1) throw new Error(`${app} backup must contain exactly one darkbot.db.`);
  verifyDatabase(databases[0]);
  return databases[0];
}

function createProductionDependencies() {
  const environment = dotenv.parse(readFileSync(path.join(PROJECT_ROOT, '.env')));
  return {
    assertPreflight: async () => {
      const gitStatus = runCommand('git', ['status', '--porcelain', '--untracked-files=normal']).output.trim();
      if (gitStatus) throw new Error('Git working tree must be clean before cutover.');
      const config = parseKeyValueFile(readFileSync(path.join(PROJECT_ROOT, 'discloud.config'), 'utf8'));
      if (config.get('ID') !== TARGET_APP) throw new Error(`discloud.config ID must be ${TARGET_APP}.`);
      if (environment.DISCORD_REDIRECT_URI !== TARGET_REDIRECT_URI) {
        throw new Error(`DISCORD_REDIRECT_URI must be ${TARGET_REDIRECT_URI}.`);
      }
      await assertCallbackRegistered(environment);
      if (getAppState(SOURCE_APP) !== 'online') throw new Error(`${SOURCE_APP} must be online before cutover.`);
      if (getAppState(TARGET_APP) !== 'missing') throw new Error(`${TARGET_APP} must not exist before cutover.`);
      if (getAppState(LEGACY_APP) !== 'offline') throw new Error(`${LEGACY_APP} must be offline before cutover.`);
    },
    stopSource: async () => {
      runCommand('discloud', ['app', 'stop', SOURCE_APP], { inherit: true });
      await waitForAppState(SOURCE_APP, 'offline');
    },
    backupSource: async () => downloadAndVerifyDatabase(SOURCE_APP, `cutover-${TARGET_APP}`),
    prepareStaging: async databasePath => {
      const stagingDirectory = path.join(tmpdir(), `${TARGET_APP}-deploy-${Math.floor(Date.now() / 1000)}`);
      try {
        runCommand('node', [
          path.join('scripts', 'prepare-discloud-staging.js'),
          '--output',
          stagingDirectory,
          '--database',
          databasePath,
        ], { inherit: true });
        const stagedDatabase = path.join(stagingDirectory, 'prisma', 'prisma', 'darkbot.db');
        if (!existsSync(stagedDatabase) || !statSync(stagedDatabase).isFile()) {
          throw new Error('Staging SQLite database is missing.');
        }
        if (sha256(databasePath) !== sha256(stagedDatabase)) {
          throw new Error('Staging SQLite database differs from the frozen Discloud backup.');
        }
        return stagingDirectory;
      } catch (error) {
        if (existsSync(stagingDirectory)) {
          cleanupStaging({ projectRoot: PROJECT_ROOT, outputDirectory: stagingDirectory });
        }
        throw error;
      }
    },
    uploadTarget: async stagingDirectory => {
      runCommand('discloud', ['app', 'upload'], { cwd: stagingDirectory, inherit: true });
    },
    waitTargetReady: async () => {
      await waitForAppState(TARGET_APP, 'online', 120_000);
      const deadline = Date.now() + 120_000;
      do {
        try {
          const response = await fetch(`https://${TARGET_APP}.discloud.app/health`, {
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
          });
          if (response.ok) {
            const body = await response.json();
            if (isTargetHealthReady(body)) return;
          }
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 5_000));
      } while (Date.now() < deadline);
      throw new Error(`${TARGET_APP} health check did not become ready.`);
    },
    assertFinalState: async () => {
      if (getAppState(TARGET_APP) !== 'online') throw new Error(`${TARGET_APP} is not online.`);
      if (getAppState(SOURCE_APP) !== 'offline') throw new Error(`${SOURCE_APP} is not offline.`);
      if (getAppState(LEGACY_APP) !== 'offline') throw new Error(`${LEGACY_APP} is not offline.`);
    },
    getTargetState: async () => getAppState(TARGET_APP),
    getSourceState: async () => getAppState(SOURCE_APP),
    stopTarget: async () => {
      runCommand('discloud', ['app', 'stop', TARGET_APP], { inherit: true });
      await waitForAppState(TARGET_APP, 'offline');
    },
    backupTargetForRecovery: async () => {
      downloadAndVerifyDatabase(TARGET_APP, `rollback-${TARGET_APP}`);
    },
    assertRollbackSafe: async () => {
      const targetState = getAppState(TARGET_APP);
      if (targetState !== 'offline' && targetState !== 'missing') {
        throw new Error(`${TARGET_APP} is not proven offline; rollback is unsafe.`);
      }
      if (getAppState(LEGACY_APP) !== 'offline') {
        throw new Error(`${LEGACY_APP} is not offline; rollback is unsafe.`);
      }
    },
    startSource: async () => {
      runCommand('discloud', ['app', 'start', SOURCE_APP], { inherit: true });
      await waitForAppState(SOURCE_APP, 'online');
    },
    cleanupStaging: async stagingDirectory => {
      cleanupStaging({ projectRoot: PROJECT_ROOT, outputDirectory: stagingDirectory });
    },
  };
}

async function main() {
  const dependencies = createProductionDependencies();
  if (process.argv.includes('--preflight')) {
    await dependencies.assertPreflight();
    process.stdout.write(`Preflight complete: ${TARGET_REDIRECT_URI}\n`);
    return;
  }
  if (!process.argv.includes('--execute')) {
    throw new Error('Use --preflight to validate or --execute to confirm the Discloud subdomain cutover.');
  }
  await runCutover(dependencies);
  process.stdout.write(`Cutover complete: https://${TARGET_APP}.discloud.app\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Cutover failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  LEGACY_APP,
  SOURCE_APP,
  TARGET_APP,
  buildSpawnInvocation,
  isTargetHealthReady,
  parseAppState,
  runCutover,
};
