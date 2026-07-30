import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlayerService,
  type PlayerRecord,
  type PlayerStore,
} from './player-service';

function createStore(initial: PlayerRecord | null): PlayerStore & { created?: unknown } {
  return {
    created: undefined,
    async find(userId, guildId) {
      return initial?.id === userId && initial.guildId === guildId ? initial : null;
    },
    async create(input) {
      this.created = input;
      return { ...input, vitorias: 0, derrotas: 0, confrontos: 0 };
    },
  };
}

test('returns an existing player scoped to user and guild', async () => {
  const existing: PlayerRecord = {
    id: 'user-1', guildId: 'guild-1', nome: 'Queen', vitorias: 2, derrotas: 1, confrontos: 3,
  };
  const service = createPlayerService(createStore(existing));

  assert.equal(await service.getOrCreate('user-1', 'guild-1', 'Changed'), existing);
});

test('creates a zeroed player when no guild profile exists', async () => {
  const store = createStore(null);
  const service = createPlayerService(store);

  const player = await service.getOrCreate('user-1', 'guild-2', 'Queen');

  assert.deepEqual(store.created, { id: 'user-1', guildId: 'guild-2', nome: 'Queen' });
  assert.deepEqual(player, {
    id: 'user-1', guildId: 'guild-2', nome: 'Queen', vitorias: 0, derrotas: 0, confrontos: 0,
  });
});
