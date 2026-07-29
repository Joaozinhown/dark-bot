import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnectionLimiter } from './connection-limiter';

test('limits connections per session and guild', () => {
  const limiter = createConnectionLimiter({ maxPerKey: 2, maxTotal: 10 });
  const first = limiter.acquire('session-a:guild-a');
  const second = limiter.acquire('session-a:guild-a');

  assert.ok(first);
  assert.ok(second);
  assert.equal(limiter.acquire('session-a:guild-a'), null);
  assert.ok(limiter.acquire('session-a:guild-b'));
});

test('limits total connections and releases a slot once', () => {
  const limiter = createConnectionLimiter({ maxPerKey: 2, maxTotal: 2 });
  const releaseFirst = limiter.acquire('first');
  const releaseSecond = limiter.acquire('second');

  assert.ok(releaseFirst);
  assert.ok(releaseSecond);
  assert.equal(limiter.acquire('third'), null);

  releaseFirst();
  releaseFirst();
  assert.ok(limiter.acquire('third'));
  assert.equal(limiter.activeCount(), 2);
});
