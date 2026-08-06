"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const report_service_1 = require("./report-service");
class MemoryReportStore {
    summaryValue;
    recentValue;
    poolsValue;
    rankingValue;
    guildCalls = [];
    constructor(summaryValue, recentValue = [], poolsValue = [], rankingValue = []) {
        this.summaryValue = summaryValue;
        this.recentValue = recentValue;
        this.poolsValue = poolsValue;
        this.rankingValue = rankingValue;
    }
    async getSummary(guildId) {
        this.guildCalls.push({ operation: 'summary', guildId });
        return structuredClone(this.summaryValue);
    }
    async listRecentConfrontations(guildId) {
        this.guildCalls.push({ operation: 'recent', guildId });
        return structuredClone(this.recentValue);
    }
    async listPoolReports(guildId) {
        this.guildCalls.push({ operation: 'pools', guildId });
        return structuredClone(this.poolsValue);
    }
    async listCompletedConfrontations(guildId) {
        this.guildCalls.push({ operation: 'ranking', guildId });
        return structuredClone(this.rankingValue);
    }
}
const summary = {
    totalConfrontos: 8,
    confrontosAtivos: 3,
    confrontosEncerrados: 5,
    jogadores: 14,
    poolsAtivas: 2,
};
(0, node_test_1.default)('scopes every report query to the supplied guild', async () => {
    const store = new MemoryReportStore(summary);
    const service = (0, report_service_1.createReportService)(store);
    await service.getSummary('guild-b');
    await service.listRecentConfrontations('guild-b');
    await service.listPoolReports('guild-b');
    await service.getRanking('guild-b', async () => null);
    strict_1.default.deepEqual(store.guildCalls, [
        { operation: 'summary', guildId: 'guild-b' },
        { operation: 'recent', guildId: 'guild-b' },
        { operation: 'pools', guildId: 'guild-b' },
        { operation: 'ranking', guildId: 'guild-b' },
    ]);
});
(0, node_test_1.default)('returns the operational summary unchanged', async () => {
    const service = (0, report_service_1.createReportService)(new MemoryReportStore(summary));
    strict_1.default.deepEqual(await service.getSummary('guild-a'), summary);
});
(0, node_test_1.default)('returns recent confrontations in store order', async () => {
    const recent = [
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
    const service = (0, report_service_1.createReportService)(new MemoryReportStore(summary, recent));
    strict_1.default.deepEqual(await service.listRecentConfrontations('guild-a'), recent);
});
(0, node_test_1.default)('returns pool report counts and active state', async () => {
    const pools = [
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
    const service = (0, report_service_1.createReportService)(new MemoryReportStore(summary, [], pools));
    strict_1.default.deepEqual(await service.listPoolReports('guild-a'), pools);
});
(0, node_test_1.default)('aggregates ranking by victories and skips confrontations with missing roles', () => {
    const confrontations = [
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
    strict_1.default.deepEqual((0, report_service_1.aggregateRanking)(confrontations, roleNames), [
        { nome: 'Alpha', vitorias: 2, derrotas: 0 },
        { nome: 'Gamma', vitorias: 1, derrotas: 1 },
        { nome: 'Beta', vitorias: 0, derrotas: 2 },
    ]);
});
(0, node_test_1.default)('resolves role names and omits matches whose role no longer exists', async () => {
    const confrontations = [
        { timeARoleId: 'alpha', timeBRoleId: 'beta', vencedor: 'B' },
        { timeARoleId: 'alpha', timeBRoleId: 'removed', vencedor: 'A' },
    ];
    const store = new MemoryReportStore(summary, [], [], confrontations);
    const service = (0, report_service_1.createReportService)(store);
    const resolvedRoleIds = [];
    const ranking = await service.getRanking('guild-a', async (roleId) => {
        resolvedRoleIds.push(roleId);
        return roleId === 'removed' ? null : roleId.toUpperCase();
    });
    strict_1.default.deepEqual(new Set(resolvedRoleIds), new Set(['alpha', 'beta', 'removed']));
    strict_1.default.deepEqual(ranking, [
        { nome: 'BETA', vitorias: 1, derrotas: 0 },
        { nome: 'ALPHA', vitorias: 0, derrotas: 1 },
    ]);
});
//# sourceMappingURL=report-service.test.js.map