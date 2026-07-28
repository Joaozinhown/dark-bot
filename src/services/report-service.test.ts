import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateRanking,
  createReportService,
  PoolReport,
  RankingConfrontation,
  RecentConfrontation,
  ReportStore,
  ReportSummary,
} from './report-service';

class MemoryReportStore implements ReportStore {
  readonly guildCalls: Array<{ operation: string; guildId: string }> = [];

  constructor(
    private readonly summaryValue: ReportSummary,
    private readonly recentValue: RecentConfrontation[] = [],
    private readonly poolsValue: PoolReport[] = [],
    private readonly rankingValue: RankingConfrontation[] = [],
  ) {}

  async getSummary(guildId: string): Promise<ReportSummary> {
    this.guildCalls.push({ operation: 'summary', guildId });
    return structuredClone(this.summaryValue);
  }

  async listRecentConfrontations(guildId: string): Promise<RecentConfrontation[]> {
    this.guildCalls.push({ operation: 'recent', guildId });
    return structuredClone(this.recentValue);
  }

  async listPoolReports(guildId: string): Promise<PoolReport[]> {
    this.guildCalls.push({ operation: 'pools', guildId });
    return structuredClone(this.poolsValue);
  }

  async listCompletedConfrontations(guildId: string): Promise<RankingConfrontation[]> {
    this.guildCalls.push({ operation: 'ranking', guildId });
    return structuredClone(this.rankingValue);
  }
}

const summary: ReportSummary = {
  totalConfrontos: 8,
  confrontosAtivos: 3,
  confrontosEncerrados: 5,
  jogadores: 14,
  poolsAtivas: 2,
};

test('scopes every report query to the supplied guild', async () => {
  const store = new MemoryReportStore(summary);
  const service = createReportService(store);

  await service.getSummary('guild-b');
  await service.listRecentConfrontations('guild-b');
  await service.listPoolReports('guild-b');
  await service.getRanking('guild-b', async () => null);

  assert.deepEqual(store.guildCalls, [
    { operation: 'summary', guildId: 'guild-b' },
    { operation: 'recent', guildId: 'guild-b' },
    { operation: 'pools', guildId: 'guild-b' },
    { operation: 'ranking', guildId: 'guild-b' },
  ]);
});

test('returns the operational summary unchanged', async () => {
  const service = createReportService(new MemoryReportStore(summary));

  assert.deepEqual(await service.getSummary('guild-a'), summary);
});

test('returns recent confrontations in store order', async () => {
  const recent: RecentConfrontation[] = [
    {
      id: 12,
      formato: 'MD5',
      status: 'encerrado',
      timeAVitorias: 3,
      timeBVitorias: 1,
      criadoEm: new Date('2026-07-28T12:00:00.000Z'),
    },
    {
      id: 11,
      formato: 'MD3',
      status: 'veto',
      timeAVitorias: 0,
      timeBVitorias: 0,
      criadoEm: new Date('2026-07-27T12:00:00.000Z'),
    },
  ];
  const service = createReportService(new MemoryReportStore(summary, recent));

  assert.deepEqual(await service.listRecentConfrontations('guild-a'), recent);
});

test('returns pool report counts and active state', async () => {
  const pools: PoolReport[] = [
    {
      id: 2,
      nome: 'Pool 2',
      formato: 'MD5',
      ativa: false,
      mapas: 5,
      killers: 11,
      confrontos: 4,
    },
  ];
  const service = createReportService(new MemoryReportStore(summary, [], pools));

  assert.deepEqual(await service.listPoolReports('guild-a'), pools);
});

test('aggregates ranking by victories and skips confrontations with missing roles', () => {
  const confrontations: RankingConfrontation[] = [
    { timeARoleId: 'alpha', timeBRoleId: 'beta', vencedor: 'A' },
    { timeARoleId: 'alpha', timeBRoleId: 'gamma', vencedor: 'A' },
    { timeARoleId: 'beta', timeBRoleId: 'gamma', vencedor: 'B' },
    { timeARoleId: 'alpha', timeBRoleId: 'missing', vencedor: 'A' },
    { timeARoleId: 'alpha', timeBRoleId: 'beta', vencedor: null },
  ];
  const roleNames = new Map([
    ['alpha', 'Alpha'],
    ['beta', 'Beta'],
    ['gamma', 'Gamma'],
  ]);

  assert.deepEqual(aggregateRanking(confrontations, roleNames), [
    { nome: 'Alpha', vitorias: 2, derrotas: 0 },
    { nome: 'Gamma', vitorias: 1, derrotas: 1 },
    { nome: 'Beta', vitorias: 0, derrotas: 2 },
  ]);
});

test('resolves role names and omits matches whose role no longer exists', async () => {
  const confrontations: RankingConfrontation[] = [
    { timeARoleId: 'alpha', timeBRoleId: 'beta', vencedor: 'B' },
    { timeARoleId: 'alpha', timeBRoleId: 'removed', vencedor: 'A' },
  ];
  const store = new MemoryReportStore(summary, [], [], confrontations);
  const service = createReportService(store);
  const resolvedRoleIds: string[] = [];

  const ranking = await service.getRanking('guild-a', async roleId => {
    resolvedRoleIds.push(roleId);
    return roleId === 'removed' ? null : roleId.toUpperCase();
  });

  assert.deepEqual(new Set(resolvedRoleIds), new Set(['alpha', 'beta', 'removed']));
  assert.deepEqual(ranking, [
    { nome: 'BETA', vitorias: 1, derrotas: 0 },
    { nome: 'ALPHA', vitorias: 0, derrotas: 1 },
  ]);
});
