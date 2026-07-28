import prisma from '../database/client';

export interface PlayerRecord {
  id: string;
  guildId: string;
  nome: string;
  vitorias: number;
  derrotas: number;
  confrontos: number;
}

export interface PlayerStore {
  find(userId: string, guildId: string): Promise<PlayerRecord | null>;
  create(input: Pick<PlayerRecord, 'id' | 'guildId' | 'nome'>): Promise<PlayerRecord>;
}

export function createPlayerService(store: PlayerStore) {
  return {
    async getOrCreate(userId: string, guildId: string, displayName: string): Promise<PlayerRecord> {
      const existing = await store.find(userId, guildId);
      if (existing) return existing;
      return store.create({ id: userId, guildId, nome: displayName });
    },
  };
}

const prismaPlayerStore: PlayerStore = {
  find: (userId, guildId) => prisma.jogador.findUnique({
    where: { id_guildId: { id: userId, guildId } },
  }),
  create: input => prisma.jogador.create({ data: input }),
};

export const playerService = createPlayerService(prismaPlayerStore);
