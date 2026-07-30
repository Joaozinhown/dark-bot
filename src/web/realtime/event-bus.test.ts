import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuildEventBus } from './event-bus';

test('publishes events only to subscribers of the same guild', () => {
  const bus = createGuildEventBus();
  const guildA: unknown[] = [];
  const guildB: unknown[] = [];
  const unsubscribe = bus.subscribe('guild-a', event => guildA.push(event));
  bus.subscribe('guild-b', event => guildB.push(event));

  bus.publish('guild-a', 'pool.updated', { poolId: 4 });
  unsubscribe();
  bus.publish('guild-a', 'pool.updated', { poolId: 5 });

  assert.equal(guildA.length, 1);
  assert.equal(guildB.length, 0);
  assert.deepEqual(guildA[0], {
    id: 1,
    guildId: 'guild-a',
    type: 'pool.updated',
    data: { poolId: 4 },
  });
});

test('uses a separate monotonic sequence for each guild', () => {
  const bus = createGuildEventBus();
  const events: Array<{ id: number }> = [];
  bus.subscribe('guild-a', event => events.push(event));

  bus.publish('guild-a', 'one', {});
  bus.publish('guild-b', 'ignored', {});
  bus.publish('guild-a', 'two', {});

  assert.deepEqual(events.map(event => event.id), [1, 2]);
});

test('isolates a failed subscriber from the publisher and other subscribers', () => {
  const bus = createGuildEventBus();
  const received: string[] = [];
  bus.subscribe('guild-a', () => { throw new Error('socket closed'); });
  bus.subscribe('guild-a', event => received.push(event.type));

  assert.doesNotThrow(() => bus.publish('guild-a', 'command.executed', {}));
  assert.deepEqual(received, ['command.executed']);
});
