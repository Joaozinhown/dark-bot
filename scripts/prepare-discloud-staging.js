const {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const STAGING_MARKER = '.dta-discloud-staging';
const STAGING_MARKER_CONTENT = 'DTA Discloud staging directory\n';

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'DATABASE_URL',
  'ADMIN_PANEL_ENABLED',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'PANEL_COOKIE_SECRET',
  'PANEL_ENCRYPTION_KEY',
  'PORT',
  'NODE_ENV',
];
const PRIVATE_RUNTIME_IGNORE_RULES = new Set([
  '.env',
  '*.db',
  '*.db-journal',
  '*.db-wal',
  '*.db-shm',
]);

function parseKeyValueFile(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]*)=(.*)$/);
    if (match) values.set(match[1].trim(), match[2].trim());
  }
  return values;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertOutsideRepository(projectRoot, outputDirectory) {
  if (existsSync(outputDirectory)) throw new Error('Staging output already exists.');
  const physicalProjectRoot = realpathSync(projectRoot);
  const physicalParent = realpathSync(path.dirname(outputDirectory));
  const physicalOutput = path.join(physicalParent, path.basename(outputDirectory));
  if (isInside(physicalProjectRoot, physicalOutput)) {
    throw new Error('Staging output must be outside the repository.');
  }
  if (!isInside(realpathSync(tmpdir()), physicalOutput)) {
    throw new Error('Staging output must be inside the operating system temporary directory.');
  }
}

function readDeploymentConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'discloud.config');
  const config = parseKeyValueFile(readFileSync(configPath, 'utf8'));
  if (config.get('TYPE') !== 'site') throw new Error('discloud.config must use TYPE=site.');
  const subdomain = config.get('ID') ?? '';
  if (!/^[a-z0-9-]{1,20}$/i.test(subdomain)) {
    throw new Error('discloud.config ID must be a valid Discloud subdomain.');
  }
  const ram = Number(config.get('RAM'));
  if (!Number.isSafeInteger(ram) || ram < 512) throw new Error('discloud.config RAM must be at least 512 MB.');
  return { subdomain };
}

function readDeploymentEnvironment(envPath, subdomain) {
  const environment = parseKeyValueFile(readFileSync(envPath, 'utf8'));
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(name => !environment.get(name));
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}.`);
  if ((environment.get('DISCORD_TOKEN') ?? '').length < 50) {
    throw new Error('DISCORD_TOKEN does not look like a production bot token.');
  }
  if (!/^\d{16,22}$/.test(environment.get('CLIENT_ID') ?? '')) {
    throw new Error('CLIENT_ID must be a Discord snowflake.');
  }
  if (!/^\d{16,22}$/.test(environment.get('GUILD_ID') ?? '')) {
    throw new Error('GUILD_ID must be a Discord snowflake.');
  }
  if ((environment.get('DISCORD_CLIENT_SECRET') ?? '').length < 16) {
    throw new Error('DISCORD_CLIENT_SECRET does not look like a production secret.');
  }
  if (environment.get('ADMIN_PANEL_ENABLED') !== 'true') throw new Error('ADMIN_PANEL_ENABLED must be true.');
  if (environment.get('PORT') !== '8080') throw new Error('PORT must be 8080.');
  if (environment.get('NODE_ENV') !== 'production') throw new Error('NODE_ENV must be production.');
  if ((environment.get('PANEL_COOKIE_SECRET') ?? '').length < 32) {
    throw new Error('PANEL_COOKIE_SECRET must contain at least 32 characters.');
  }
  const encryptionKey = environment.get('PANEL_ENCRYPTION_KEY') ?? '';
  const decodedKey = Buffer.from(encryptionKey, 'base64');
  if (decodedKey.length !== 32 || decodedKey.toString('base64') !== encryptionKey) {
    throw new Error('PANEL_ENCRYPTION_KEY must be canonical base64 for exactly 32 bytes.');
  }
  const redirect = new URL(environment.get('DISCORD_REDIRECT_URI'));
  const expectedHost = `${subdomain}.discloud.app`;
  if (redirect.protocol !== 'https:'
    || redirect.hostname !== expectedHost
    || redirect.pathname !== '/api/auth/callback') {
    throw new Error(`DISCORD_REDIRECT_URI must be https://${expectedHost}/api/auth/callback.`);
  }
}

function safeTrackedPath(projectRoot, relativePath) {
  const normalized = relativePath.replaceAll('/', path.sep);
  const source = path.resolve(projectRoot, normalized);
  const relative = path.relative(projectRoot, source);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Tracked path escapes repository: ${relativePath}`);
  }
  const sourceStats = lstatSync(source);
  if (sourceStats.isSymbolicLink()) throw new Error(`Tracked path cannot be a symbolic link: ${relativePath}`);
  const physicalSource = realpathSync(source);
  if (!isInside(realpathSync(projectRoot), physicalSource)) {
    throw new Error(`Tracked path escapes repository: ${relativePath}`);
  }
  if (!statSync(physicalSource).isFile()) throw new Error(`Tracked path is not a file: ${relativePath}`);
  return { source: physicalSource, relative };
}

function assertPrivateRuntimeFile(projectRoot, filePath, label) {
  if (lstatSync(filePath).isSymbolicLink()) throw new Error(`${label} cannot be a symbolic link.`);
  const physicalPath = realpathSync(filePath);
  if (!isInside(realpathSync(projectRoot), physicalPath) || !statSync(physicalPath).isFile()) {
    throw new Error(`${label} must be a file inside the repository.`);
  }
  return physicalPath;
}

function createStagingIgnore(projectRoot, outputDirectory) {
  const source = readFileSync(path.join(projectRoot, '.discloudignore'), 'utf8');
  const rules = source.split(/\r?\n/)
    .filter(line => !PRIVATE_RUNTIME_IGNORE_RULES.has(line.trim()));
  const stagingRules = [...rules, STAGING_MARKER];
  writeFileSync(path.join(outputDirectory, '.discloudignore'), `${stagingRules.join('\n').trimEnd()}\n`);
}

function readCleanTrackedFiles(projectRoot) {
  const gitStatus = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (gitStatus.trim()) throw new Error('Git working tree must be clean before staging.');
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);
}

function cleanupStaging(options) {
  const projectRoot = realpathSync(path.resolve(options.projectRoot));
  const outputDirectory = path.resolve(options.outputDirectory);
  if (!existsSync(outputDirectory) || lstatSync(outputDirectory).isSymbolicLink()) {
    throw new Error('Path is not a DTA staging directory.');
  }
  const physicalOutput = realpathSync(outputDirectory);
  if (isInside(projectRoot, physicalOutput) || !isInside(realpathSync(tmpdir()), physicalOutput)) {
    throw new Error('Refusing to clean a staging directory outside the safe temporary boundary.');
  }
  const markerPath = path.join(physicalOutput, STAGING_MARKER);
  if (!existsSync(markerPath)
    || lstatSync(markerPath).isSymbolicLink()
    || readFileSync(markerPath, 'utf8') !== STAGING_MARKER_CONTENT) {
    throw new Error('Path is not a DTA staging directory.');
  }
  rmSync(physicalOutput, { recursive: true, force: false });
}

function prepareStaging(options) {
  const projectRoot = path.resolve(options.projectRoot);
  const outputDirectory = path.resolve(options.outputDirectory);
  const envPath = path.resolve(options.envPath);
  const databasePath = path.resolve(options.databasePath);

  assertOutsideRepository(projectRoot, outputDirectory);
  const { subdomain } = readDeploymentConfig(projectRoot);
  readDeploymentEnvironment(envPath, subdomain);
  const safeEnvPath = assertPrivateRuntimeFile(projectRoot, envPath, '.env');
  const safeDatabasePath = assertPrivateRuntimeFile(projectRoot, databasePath, 'SQLite database');

  const trackedFiles = (options.trackedFiles ?? readCleanTrackedFiles(projectRoot))
    .filter(relativePath => relativePath !== '.discloudignore')
    .map(relativePath => safeTrackedPath(projectRoot, relativePath));

  mkdirSync(outputDirectory, { recursive: false });
  writeFileSync(path.join(outputDirectory, STAGING_MARKER), STAGING_MARKER_CONTENT);
  try {
    for (const file of trackedFiles) {
      const destination = path.join(outputDirectory, file.relative);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(file.source, destination);
    }
    createStagingIgnore(projectRoot, outputDirectory);
    copyFileSync(safeEnvPath, path.join(outputDirectory, '.env'));
    const databaseDestination = path.join(outputDirectory, 'prisma', 'prisma', 'darkbot.db');
    mkdirSync(path.dirname(databaseDestination), { recursive: true });
    copyFileSync(safeDatabasePath, databaseDestination);
  } catch (error) {
    cleanupStaging({ projectRoot, outputDirectory });
    throw error;
  }

  return { outputDirectory, trackedFileCount: trackedFiles.length, subdomain };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runCli() {
  const projectRoot = path.resolve(__dirname, '..');
  const cleanupDirectory = readArgument('--cleanup');
  if (cleanupDirectory) {
    cleanupStaging({ projectRoot, outputDirectory: cleanupDirectory });
    process.stdout.write(`Staging removed: ${path.resolve(cleanupDirectory)}\n`);
    return;
  }
  const outputDirectory = readArgument('--output');
  if (!outputDirectory) {
    throw new Error('Usage: node scripts/prepare-discloud-staging.js --output <path> | --cleanup <path>');
  }
  const result = prepareStaging({
    projectRoot,
    outputDirectory,
    envPath: readArgument('--env') ?? path.join(projectRoot, '.env'),
    databasePath: readArgument('--database') ?? path.join(projectRoot, 'prisma', 'prisma', 'darkbot.db'),
  });
  process.stdout.write(`Staging ready: ${result.outputDirectory}\n`);
  process.stdout.write(`Tracked files copied: ${result.trackedFileCount}\n`);
  process.stdout.write(`Subdomain: ${result.subdomain}.discloud.app\n`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Staging failed: ${message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { cleanupStaging, prepareStaging, readCleanTrackedFiles };
