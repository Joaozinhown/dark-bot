import prisma from '../database/client';
import { getSetsMaximos } from '../config';
import { drawStartingTeam } from '../systems/veto-rules';
import type { PoolFormato, VencedorTime, VetoVez } from '../types/index';

export type ConfrontationErrorCode =
  | 'POOL_NOT_FOUND'
  | 'INVALID_MAP_COUNT'
  | 'INSUFFICIENT_KILLERS'
  | 'SAME_TEAM'
  | 'NOT_FOUND'
  | 'ALREADY_CLOSED'
  | 'INVALID_WINNER';

export class ConfrontationServiceError extends Error {
  constructor(
    public readonly code: ConfrontationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ConfrontationServiceError';
  }
}

export interface PoolRecord {
  id: number;
  guildId: string;
  formato: PoolFormato;
  ativa: boolean;
  mapas: string[];
  killers: string[];
}

export interface ConfrontationRecord {
  id: number;
  guildId: string;
  poolId: number;
  formato: PoolFormato;
  timeARoleId: string;
  timeBRoleId: string;
  timeAVitorias: number;
  timeBVitorias: number;
  status: string;
  currentSet: number;
  channelId: string | null;
  vozTimeAId: string | null;
  vozTimeBId: string | null;
  vencedor: VencedorTime | null;
  primeiroKiller: VetoVez | null;
  encerradoEm: Date | null;
  motivoEncerramento: string | null;
  criadoEm: Date;
}

export interface CreateConfrontationInput {
  guildId: string;
  poolId: number;
  timeARoleId: string;
  timeBRoleId: string;
  channelId: string;
}

export interface CreateConfrontationRecordInput extends CreateConfrontationInput {
  formato: PoolFormato;
  primeiroKiller: VetoVez;
  status: 'veto';
}

export interface CreatedConfrontation extends ConfrontationRecord {
  poolConfig: {
    id: number;
    formato: PoolFormato;
    mapas: string[];
    killers: string[];
  };
}

interface PreparedConfrontation {
  record: CreateConfrontationRecordInput;
  poolConfig: CreatedConfrontation['poolConfig'];
}

export interface ConfrontationStore {
  findPool(guildId: string, poolId: number): Promise<PoolRecord | null>;
  create(input: CreateConfrontationRecordInput): Promise<ConfrontationRecord>;
  findById(id: number, guildId: string): Promise<ConfrontationRecord | null>;
  recordResult(
    id: number,
    guildId: string,
    winner: VencedorTime,
  ): Promise<ConfrontationRecord | null>;
  close(
    id: number,
    guildId: string,
    reason: string | null,
    closedAt: Date,
  ): Promise<ConfrontationRecord | null>;
  listActive(guildId: string): Promise<ConfrontationRecord[]>;
}

function toConfrontationRecord(record: {
  id: number;
  guildId: string;
  poolId: number;
  formato: string;
  timeARoleId: string;
  timeBRoleId: string;
  timeAVitorias: number;
  timeBVitorias: number;
  status: string;
  currentSet: number;
  channelId: string | null;
  vozTimeAId: string | null;
  vozTimeBId: string | null;
  vencedor: string | null;
  primeiroKiller: string | null;
  encerradoEm: Date | null;
  motivoEncerramento: string | null;
  criadoEm: Date;
}): ConfrontationRecord {
  return {
    ...record,
    formato: record.formato as PoolFormato,
    vencedor: record.vencedor as VencedorTime | null,
    primeiroKiller: record.primeiroKiller as VetoVez | null,
  };
}

export const prismaConfrontationStore: ConfrontationStore = {
  async findPool(guildId, poolId) {
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, guildId, ativa: true },
      include: {
        mapas: { orderBy: { ordem: 'asc' } },
        killers: { orderBy: { ordem: 'asc' } },
      },
    });

    if (!pool) return null;

    return {
      id: pool.id,
      guildId: pool.guildId,
      formato: pool.formato as PoolFormato,
      ativa: pool.ativa,
      mapas: pool.mapas.map(item => item.nome),
      killers: pool.killers.map(item => item.nome),
    };
  },

  async create(input) {
    const record = await prisma.confronto.create({ data: input });
    return toConfrontationRecord(record);
  },

  async findById(id, guildId) {
    const record = await prisma.confronto.findFirst({ where: { id, guildId } });
    return record ? toConfrontationRecord(record) : null;
  },

  async recordResult(id, guildId, winner) {
    return prisma.$transaction(async transaction => {
      const result = await transaction.confronto.updateMany({
        where: { id, guildId, status: { not: 'encerrado' } },
        data: {
          vencedor: winner,
          timeAVitorias: winner === 'A' ? { increment: 1 } : undefined,
          timeBVitorias: winner === 'B' ? { increment: 1 } : undefined,
          status: 'resultado',
        },
      });
      if (result.count !== 1) return null;
      const updated = await transaction.confronto.findFirstOrThrow({ where: { id, guildId } });
      return toConfrontationRecord(updated);
    });
  },

  async close(id, guildId, reason, closedAt) {
    return prisma.$transaction(async transaction => {
      const result = await transaction.confronto.updateMany({
        where: { id, guildId, status: { not: 'encerrado' } },
        data: {
          status: 'encerrado',
          encerradoEm: closedAt,
          motivoEncerramento: reason,
        },
      });
      if (result.count !== 1) return null;
      const updated = await transaction.confronto.findFirstOrThrow({ where: { id, guildId } });
      return toConfrontationRecord(updated);
    });
  },

  async listActive(guildId) {
    const records = await prisma.confronto.findMany({
      where: { guildId, status: { not: 'encerrado' } },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    });
    return records.map(toConfrontationRecord);
  },
};

export function createConfrontationService(
  store: ConfrontationStore = prismaConfrontationStore,
  random: () => number = Math.random,
) {
  async function prepareCreate(input: CreateConfrontationInput): Promise<PreparedConfrontation> {
    const pool = await store.findPool(input.guildId, input.poolId);
    if (!pool) {
      throw new ConfrontationServiceError('POOL_NOT_FOUND', 'Pool nao encontrada ou inativa.');
    }

    const maximumSets = getSetsMaximos(pool.formato);
    if (pool.mapas.length !== maximumSets) {
      throw new ConfrontationServiceError(
        'INVALID_MAP_COUNT',
        `A pool ${pool.formato} precisa ter exatamente ${maximumSets} mapas presetados.`,
      );
    }

    if (pool.killers.length <= maximumSets) {
      throw new ConfrontationServiceError(
        'INSUFFICIENT_KILLERS',
        `A pool precisa ter mais de ${maximumSets} killers para permitir bans.`,
      );
    }

    if (input.timeARoleId === input.timeBRoleId) {
      throw new ConfrontationServiceError('SAME_TEAM', 'Os times devem ser diferentes.');
    }

    return {
      record: {
        ...input,
        formato: pool.formato,
        primeiroKiller: drawStartingTeam(random),
        status: 'veto',
      },
      poolConfig: {
        id: pool.id,
        formato: pool.formato,
        mapas: pool.mapas,
        killers: pool.killers,
      },
    };
  }

  async function createPrepared(prepared: PreparedConfrontation): Promise<CreatedConfrontation> {
    const confrontation = await store.create(prepared.record);
    return { ...confrontation, poolConfig: prepared.poolConfig };
  }

  async function prepareClose(id: number, guildId: string): Promise<ConfrontationRecord> {
    const confrontation = await store.findById(id, guildId);
    if (!confrontation) {
      throw new ConfrontationServiceError('NOT_FOUND', 'Confronto nao encontrado.');
    }
    if (confrontation.status === 'encerrado') {
      throw new ConfrontationServiceError('ALREADY_CLOSED', 'Este confronto ja foi encerrado.');
    }
    return confrontation;
  }

  return {
    async create(
      input: CreateConfrontationInput,
      beforeCommit: () => Promise<unknown> = async () => undefined,
    ): Promise<CreatedConfrontation> {
      const prepared = await prepareCreate(input);
      await beforeCommit();
      return createPrepared(prepared);
    },

    async recordResult(
      id: number,
      winnerRoleId: string,
      guildId: string,
    ): Promise<{ previous: ConfrontationRecord; updated: ConfrontationRecord; winner: VencedorTime }> {
      const confrontation = await store.findById(id, guildId);
      if (!confrontation) {
        throw new ConfrontationServiceError('NOT_FOUND', 'Confronto nao encontrado.');
      }
      if (confrontation.status === 'encerrado') {
        throw new ConfrontationServiceError('ALREADY_CLOSED', 'Este confronto ja foi encerrado.');
      }
      if (![confrontation.timeARoleId, confrontation.timeBRoleId].includes(winnerRoleId)) {
        throw new ConfrontationServiceError('INVALID_WINNER', 'O time vencedor deve ser um dos participantes.');
      }

      const winner: VencedorTime = winnerRoleId === confrontation.timeARoleId ? 'A' : 'B';
      const updated = await store.recordResult(id, guildId, winner);
      if (!updated) {
        throw new ConfrontationServiceError('ALREADY_CLOSED', 'Este confronto ja foi encerrado.');
      }
      return { previous: confrontation, updated, winner };
    },

    async close(
      id: number,
      reason: string | null,
      guildId: string,
      beforeCommit: () => Promise<unknown> = async () => undefined,
    ): Promise<ConfrontationRecord> {
      const confrontation = await prepareClose(id, guildId);
      await beforeCommit();
      const closed = await store.close(confrontation.id, guildId, reason, new Date());
      if (!closed) {
        throw new ConfrontationServiceError('ALREADY_CLOSED', 'Este confronto ja foi encerrado.');
      }
      return closed;
    },

    listActive(guildId: string): Promise<ConfrontationRecord[]> {
      return store.listActive(guildId);
    },
  };
}

export const confrontationService = createConfrontationService();
