const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildArchiveExtractionInvocation,
  buildSpawnInvocation,
  isTargetHealthReady,
  parseAppState,
  runCutover,
} = require('./discloud-subdomain-cutover');

test('extracts backups without passing paths through a command shell', () => {
  const invocation = buildArchiveExtractionInvocation('C:\\backup path\\app.zip', 'C:\\extract path');
  assert.equal(invocation.command, process.platform === 'win32' ? 'tar.exe' : 'tar');
  assert.deepEqual(invocation.args, ['-xf', 'C:\\backup path\\app.zip', '-C', 'C:\\extract path']);
});

test('runs the Windows Discloud JavaScript entrypoint without a command shell', () => {
  const entrypoint = String.raw`C:\Users\tester\AppData\Roaming\npm\node_modules\discloud-cli\bin\discloud`;
  const invocation = buildSpawnInvocation(
    'discloud',
    ['app', 'status', 'dta-admin'],
    'win32',
    () => entrypoint,
  );
  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args, [
    entrypoint,
    'app',
    'status',
    'dta-admin',
  ]);
});

function createDependencies(overrides = {}) {
  const events = [];
  const dependencies = {
    assertPreflight: async () => events.push('preflight'),
    stopSource: async () => events.push('stop-source'),
    backupSource: async () => {
      events.push('backup-source');
      return 'live.db';
    },
    prepareStaging: async database => {
      events.push(`prepare:${database}`);
      return 'stage';
    },
    uploadTarget: async stage => events.push(`upload:${stage}`),
    waitTargetReady: async () => events.push('target-ready'),
    assertFinalState: async () => events.push('final-state'),
    getTargetState: async () => 'missing',
    getSourceState: async () => 'offline',
    stopTarget: async () => events.push('stop-target'),
    backupTargetForRecovery: async () => events.push('backup-target'),
    assertRollbackSafe: async () => {},
    startSource: async () => events.push('start-source'),
    cleanupStaging: async stage => events.push(`cleanup:${stage}`),
    ...overrides,
  };
  return { dependencies, events };
}

test('cuts over using the frozen Discloud database', async () => {
  const { dependencies, events } = createDependencies();

  await runCutover(dependencies);

  assert.deepEqual(events, [
    'preflight',
    'stop-source',
    'backup-source',
    'prepare:live.db',
    'upload:stage',
    'target-ready',
    'final-state',
    'cleanup:stage',
  ]);
});

test('restores the source when backup fails before target upload', async () => {
  const { dependencies, events } = createDependencies({
    backupSource: async () => {
      events.push('backup-source');
      throw new Error('backup failed');
    },
  });

  await assert.rejects(() => runCutover(dependencies), /backup failed/);

  assert.deepEqual(events, [
    'preflight',
    'stop-source',
    'backup-source',
    'start-source',
  ]);
});

test('restores the source when stop confirmation fails', async () => {
  const { dependencies, events } = createDependencies({
    stopSource: async () => {
      events.push('stop-source');
      throw new Error('stop confirmation failed');
    },
    getSourceState: async () => 'online',
  });

  await assert.rejects(() => runCutover(dependencies), /stop confirmation failed/);

  assert.deepEqual(events, [
    'preflight',
    'stop-source',
  ]);
});

test('does not start the source when its rollback state is unknown', async () => {
  const { dependencies, events } = createDependencies({
    backupSource: async () => {
      events.push('backup-source');
      throw new Error('backup failed');
    },
    getSourceState: async () => 'unknown',
  });

  await assert.rejects(() => runCutover(dependencies), /source state is unknown/i);
  assert.equal(events.includes('start-source'), false);
});

test('stops a partially uploaded target before restoring the source', async () => {
  const { dependencies, events } = createDependencies({
    uploadTarget: async stage => {
      events.push(`upload:${stage}`);
      throw new Error('upload failed');
    },
    getTargetState: async () => 'online',
  });

  await assert.rejects(() => runCutover(dependencies), /upload failed/);

  assert.deepEqual(events, [
    'preflight',
    'stop-source',
    'backup-source',
    'prepare:live.db',
    'upload:stage',
    'stop-target',
    'backup-target',
    'start-source',
    'cleanup:stage',
  ]);
});

test('keeps the source offline when target creation may still be pending', async () => {
  const { dependencies, events } = createDependencies({
    uploadTarget: async stage => {
      events.push(`upload:${stage}`);
      throw new Error('upload failed');
    },
    getTargetState: async () => 'missing',
  });

  await assert.rejects(() => runCutover(dependencies), /creation may still be pending/i);
  assert.equal(events.includes('start-source'), false);
  assert.equal(events.includes('cleanup:stage'), true);
});

test('manually stops an offline uploaded target before restoring the source', async () => {
  const { dependencies, events } = createDependencies({
    waitTargetReady: async () => {
      events.push('target-ready');
      throw new Error('health failed');
    },
    getTargetState: async () => 'offline',
  });

  await assert.rejects(() => runCutover(dependencies), /health failed/);
  assert.equal(events.includes('stop-target'), true);
  assert.equal(events.includes('backup-target'), true);
  assert.equal(events.includes('start-source'), true);
});

test('does not start the source when target state cannot be proven safe', async () => {
  const { dependencies, events } = createDependencies({
    uploadTarget: async stage => {
      events.push(`upload:${stage}`);
      throw new Error('upload failed');
    },
    getTargetState: async () => 'unknown',
  });

  await assert.rejects(() => runCutover(dependencies), /target state is unknown/i);
  assert.equal(events.includes('start-source'), false);
  assert.equal(events.includes('cleanup:stage'), true);
});

test('does not stop production when preflight fails', async () => {
  const { dependencies, events } = createDependencies({
    assertPreflight: async () => {
      events.push('preflight');
      throw new Error('callback missing');
    },
  });

  await assert.rejects(() => runCutover(dependencies), /callback missing/);
  assert.deepEqual(events, ['preflight']);
});

test('parses Discloud app states without treating unknown failures as missing', () => {
  assert.equal(parseAppState('dta-admin', 0, 'dta-admin  Online  0.00%'), 'online');
  assert.equal(parseAppState('dta-admin', 0, 'dta-admin  Offline  0%'), 'offline');
  assert.equal(parseAppState('admin-dta-bot', 1, '[Discloud API: 404] Aplicacao nao encontrada'), 'missing');
  assert.equal(parseAppState('admin-dta-bot', 1, 'network timeout'), 'unknown');
});

test('requires Discord readiness and all approved slash commands', () => {
  assert.equal(isTargetHealthReady({ data: { botReady: true, commandCount: 11 } }), true);
  assert.equal(isTargetHealthReady({ data: { botReady: true, commandCount: 10 } }), false);
  assert.equal(isTargetHealthReady({ data: { botReady: false, commandCount: 11 } }), false);
});
