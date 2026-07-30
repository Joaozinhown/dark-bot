import assert from 'node:assert/strict';
import test from 'node:test';
import type { Guild } from 'discord.js';
import { hasLiveGuildAccess } from './runtime';

test('forces a fresh Discord member fetch before granting guild access', async () => {
  const fetchCalls: unknown[] = [];
  const guild = {
    id: 'guild-a',
    ownerId: 'user-1',
    members: {
      async fetch(options: unknown) {
        fetchCalls.push(options);
        return {
          permissions: { has: () => false },
          roles: { cache: new Map([['role-a', {}]]) },
        };
      },
    },
  } as unknown as Guild;

  assert.equal(await hasLiveGuildAccess(guild, 'user-1'), true);
  assert.deepEqual(fetchCalls, [{ user: 'user-1', force: true }]);
});

test('denies guild access when the fresh member fetch fails', async () => {
  const guild = {
    id: 'guild-a',
    ownerId: 'user-1',
    members: {
      async fetch() {
        throw new Error('Unknown Member');
      },
    },
  } as unknown as Guild;

  assert.equal(await hasLiveGuildAccess(guild, 'user-1'), false);
});
