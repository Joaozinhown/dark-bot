import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGuildPermissionService,
  type GuildPermissionStore,
} from './guild-permission-service';

function createStore(initialValues: Readonly<Record<string, string>> = {}): {
  readonly store: GuildPermissionStore;
  readonly values: Map<string, string>;
  readonly reads: string[];
} {
  const values = new Map(Object.entries(initialValues));
  const reads: string[] = [];

  return {
    values,
    reads,
    store: {
      async getAdminRoleIds(guildId) {
        reads.push(guildId);
        return values.get(guildId) ?? null;
      },
      async setAdminRoleIds(guildId, adminRoleIds) {
        values.set(guildId, adminRoleIds);
      },
    },
  };
}

test('returns no roles when stored JSON is invalid or not an array', async () => {
  const { store } = createStore({
    invalid: '{broken',
    object: '{"role":"role-1"}',
  });
  const service = createGuildPermissionService(store);

  assert.deepEqual(await service.listAdminRoleIds('invalid'), []);
  assert.deepEqual(await service.listAdminRoleIds('object'), []);
  assert.deepEqual(await service.listAdminRoleIds('missing'), []);
});

test('filters invalid values and deduplicates stored role IDs', async () => {
  const { store } = createStore({
    guildA: JSON.stringify(['role-1', 42, '', 'role-1', 'role-2', null]),
  });
  const service = createGuildPermissionService(store);

  assert.deepEqual(await service.listAdminRoleIds('guildA'), [
    'role-1',
    'role-2',
  ]);
});

test('adds and removes roles without duplicates', async () => {
  const { store, values } = createStore({
    guildA: JSON.stringify(['role-1']),
  });
  const service = createGuildPermissionService(store);

  assert.deepEqual(await service.addAdminRole('guildA', 'role-1'), ['role-1']);
  assert.deepEqual(await service.addAdminRole('guildA', 'role-2'), [
    'role-1',
    'role-2',
  ]);
  assert.deepEqual(await service.removeAdminRole('guildA', 'role-1'), [
    'role-2',
  ]);
  assert.equal(values.get('guildA'), JSON.stringify(['role-2']));
});

test('keeps role configuration isolated by guild', async () => {
  const { store } = createStore({
    guildA: JSON.stringify(['role-a']),
    guildB: JSON.stringify(['role-b']),
  });
  const service = createGuildPermissionService(store);

  await service.addAdminRole('guildA', 'role-a2');

  assert.deepEqual(await service.listAdminRoleIds('guildA'), [
    'role-a',
    'role-a2',
  ]);
  assert.deepEqual(await service.listAdminRoleIds('guildB'), ['role-b']);
});

test('grants Manage Guild permission without reading stored roles', async () => {
  const { store, reads } = createStore();
  const service = createGuildPermissionService(store);

  const allowed = await service.hasBotAdminPermission({
    guildId: 'guildA',
    hasManageGuild: true,
    roleIds: [],
  });

  assert.equal(allowed, true);
  assert.deepEqual(reads, []);
});

test('evaluates configured roles only within the subject guild', async () => {
  const { store } = createStore({
    guildA: JSON.stringify(['role-a']),
    guildB: JSON.stringify(['role-b']),
  });
  const service = createGuildPermissionService(store);

  assert.equal(
    await service.hasBotAdminPermission({
      guildId: 'guildA',
      hasManageGuild: false,
      roleIds: ['role-a'],
    }),
    true,
  );
  assert.equal(
    await service.hasBotAdminPermission({
      guildId: 'guildA',
      hasManageGuild: false,
      roleIds: ['role-b'],
    }),
    false,
  );
});
