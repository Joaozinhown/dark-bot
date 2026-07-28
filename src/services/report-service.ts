import prisma from '../database/client';

export interface ReportSummary {
  totalConfrontos: number;
  confrontosAtivos: number;
  confrontosEncerrados: number;
  jogadores: number;
  poolsAtivas: number;
}

export interface RecentConfrontation {
  id: number;
  formato: string;
  status: string;
  timeAVitorias: number;
  timeBVitorias: number;
  criadoEm: Date;
}

export interface PoolReport {
  id: number;
  nome: string;
  formato: string;
  ativa: boolean;
  mapas: number;
  killers: number;
  confrontos: number;
}

export interface RankingConfrontation {
  timeARoleId: string;
  timeBRoleId: string;
  vencedor: 'A' | 'B' | null;
}

export interface RankingEntry {
  nome: string;
  vitorias: number;
  derrotas: number;
}

export type RoleNameResolver = (roleId: string) => Promise<string | null>;

export interface ReportStore {
  getSummary(guildId: string): Promise<ReportSummary>;
  listRecentConfrontations(guildId: string): Promise<RecentConfrontation[]>;
  listPoolReports(guildId: string): Promise<PoolReport[]>;
  listCompletedConfrontations(guildId: string): Promise<RankingConfrontation[]>;
}

export function aggregateRanking(
  confrontations: readonly RankingConfrontation[],
  roleNames: ReadonlyMap<string, string>,
): RankingEntry[] {
  const entries = new Map<string, RankingEntry>();

  for (const confrontation of confrontations) {
    if (!confrontation.vencedor) continue;

    const timeAName = roleNames.get(confrontation.timeARoleId);
    const timeBName = roleNames.get(confrontation.timeBRoleId);
    if (!timeAName || !timeBName) continue;

    const timeA = entries.get(confrontation.timeARoleId) ?? {
      nome: timeAName,
      vitorias: 0,
      derrotas: 0,
    };
    const timeB = entries.get(confrontation.timeBRoleId) ?? {
      nome: timeBName,
      vitorias: 0,
      derrotas: 0,
    };

    entries.set(confrontation.timeARoleId, confrontation.vencedor === 'A'
      ? { ...timeA, vitorias: timeA.vitorias + 1 }
      : { ...timeA, derrotas: timeA.derrotas + 1 });
    entries.set(confrontation.timeBRoleId, confrontation.vencedor === 'B'
      ? { ...timeB, vitorias: timeB.vitorias + 1 }
      : { ...timeB, derrotas: timeB.derrotas + 1 });
  }

  return [...entries.values()].sort((left, right) => right.vitorias - left.vitorias);
}

export function createReportService(store: ReportStore) {
  return {
    getSummary(guildId: string): Promise<ReportSummary> {
      return store.getSummary(guildId);
    },

    listRecentConfrontations(guildId: string): Promise<RecentConfrontation[]> {
      return store.listRecentConfrontations(guildId);
    },

    listPoolReports(guildId: string): Promise<PoolReport[]> {
      return store.listPoolReports(guildId);
    },

    async getRanking(guildId: string, resolveRoleName: RoleNameResolver): Promise<RankingEntry[]> {
      const confrontations = await store.listCompletedConfrontations(guildId);
      const roleIds = [...new Set(confrontations.flatMap(confrontation => [
        confrontation.timeARoleId,
        confrontation.timeBRoleId,
      ]))];
      const resolvedRoles = await Promise.all(roleIds.map(async roleId => [
        roleId,
        await resolveRoleName(roleId),
      ] as const));
      const roleNames = new Map(
        resolvedRoles.filter((entry): entry is readonly [string, string] => entry[1] !== null),
      );

      return aggregateRanking(confrontations, roleNames);
    },
  };
}

export const prismaReportStore: ReportStore = {
  async getSummary(guildId) {
    const [totalConfrontos, confrontosAtivos, confrontosEncerrados, jogadores, poolsAtivas] = await Promise.all([
      prisma.confronto.count({ where: { guildId } }),
      prisma.confronto.count({ where: { guildId, status: { not: 'encerrado' } } }),
      prisma.confronto.count({ where: { guildId, status: 'encerrado' } }),
      prisma.jogador.count({ where: { guildId } }),
      prisma.pool.count({ where: { guildId, ativa: true } }),
    ]);

    return { totalConfrontos, confrontosAtivos, confrontosEncerrados, jogadores, poolsAtivas };
  },

  listRecentConfrontations(guildId) {
    return prisma.confronto.findMany({
      where: { guildId },
      select: {
        id: true,
        formato: true,
        status: true,
        timeAVitorias: true,
        timeBVitorias: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    });
  },

  async listPoolReports(guildId) {
    const pools = await prisma.pool.findMany({
      where: { guildId },
      include: {
        mapas: true,
        killers: true,
        _count: { select: { confrontos: true } },
      },
      orderBy: { id: 'asc' },
    });

    return pools.map(pool => ({
      id: pool.id,
      nome: pool.nome,
      formato: pool.formato,
      ativa: pool.ativa,
      mapas: pool.mapas.length,
      killers: pool.killers.length,
      confrontos: pool._count.confrontos,
    }));
  },

  async listCompletedConfrontations(guildId) {
    const confrontations = await prisma.confronto.findMany({
      where: { guildId, status: 'encerrado' },
      select: {
        timeARoleId: true,
        timeBRoleId: true,
        vencedor: true,
      },
    });

    return confrontations.map(confrontation => ({
      ...confrontation,
      vencedor: confrontation.vencedor as 'A' | 'B' | null,
    }));
  },
};

export const reportService = createReportService(prismaReportStore);
