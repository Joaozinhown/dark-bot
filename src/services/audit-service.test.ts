import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAuditService,
  type AuditRecord,
  type AuditStore,
} from './audit-service';

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: 1,
    guildId: 'guild-a',
    actorUserId: 'user-a',
    action: 'pool.updated',
    entityType: 'pool',
    entityId: '4',
    details: '{"name":"Pool 4"}',
    criadoEm: new Date('2026-07-28T12:00:00.000Z'),
    ...overrides,
  };
}

test('serializes structured audit details on write', async () => {
  let input: unknown;
  const store: AuditStore = {
    create: async value => {
      input = value;
      return record(value);
    },
    listByGuild: async () => [],
  };
  const service = createAuditService(store);

  await service.write({
    guildId: 'guild-a',
    actorUserId: 'user-a',
    action: 'pool.updated',
    entityType: 'pool',
    entityId: '4',
    details: { name: 'Pool 4' },
  });

  assert.deepEqual(input, {
    guildId: 'guild-a',
    actorUserId: 'user-a',
    action: 'pool.updated',
    entityType: 'pool',
    entityId: '4',
    details: '{"name":"Pool 4"}',
  });
});

test('lists only the requested guild and caps the page size', async () => {
  const calls: Array<[string, number]> = [];
  const store: AuditStore = {
    create: async value => record(value),
    listByGuild: async (guildId, limit) => {
      calls.push([guildId, limit]);
      return [record({ guildId })];
    },
  };
  const service = createAuditService(store);

  const entries = await service.list('guild-b', 500);

  assert.deepEqual(calls, [['guild-b', 100]]);
  assert.equal(entries[0].guildId, 'guild-b');
  assert.deepEqual(entries[0].details, { name: 'Pool 4' });
});

test('returns an empty detail object for malformed legacy JSON', async () => {
  const store: AuditStore = {
    create: async value => record(value),
    listByGuild: async () => [record({ details: '{broken' })],
  };

  const entries = await createAuditService(store).list('guild-a');

  assert.deepEqual(entries[0].details, {});
});
