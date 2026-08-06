"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = exports.prismaReportStore = void 0;
exports.aggregateRanking = aggregateRanking;
exports.createReportService = createReportService;
const client_1 = __importDefault(require("../database/client"));
function aggregateRanking(confrontations, roleNames) {
    const entries = new Map();
    for (const confrontation of confrontations) {
        if (!confrontation.vencedor)
            continue;
        const timeAName = roleNames.get(confrontation.timeARoleId);
        const timeBName = roleNames.get(confrontation.timeBRoleId);
        if (!timeAName || !timeBName)
            continue;
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
function createReportService(store) {
    return {
        getSummary(guildId) {
            return store.getSummary(guildId);
        },
        listRecentConfrontations(guildId) {
            return store.listRecentConfrontations(guildId);
        },
        listPoolReports(guildId) {
            return store.listPoolReports(guildId);
        },
        async getRanking(guildId, resolveRoleName) {
            const confrontations = await store.listCompletedConfrontations(guildId);
            const roleIds = [...new Set(confrontations.flatMap(confrontation => [
                    confrontation.timeARoleId,
                    confrontation.timeBRoleId,
                ]))];
            const resolvedRoles = await Promise.all(roleIds.map(async (roleId) => [
                roleId,
                await resolveRoleName(roleId),
            ]));
            const roleNames = new Map(resolvedRoles.filter((entry) => entry[1] !== null));
            return aggregateRanking(confrontations, roleNames);
        },
    };
}
exports.prismaReportStore = {
    async getSummary(guildId) {
        const [totalConfrontos, confrontosAtivos, confrontosEncerrados, jogadores, poolsAtivas] = await Promise.all([
            client_1.default.confronto.count({ where: { guildId } }),
            client_1.default.confronto.count({ where: { guildId, status: { not: 'encerrado' } } }),
            client_1.default.confronto.count({ where: { guildId, status: 'encerrado' } }),
            client_1.default.jogador.count({ where: { guildId } }),
            client_1.default.pool.count({ where: { guildId, ativa: true } }),
        ]);
        return { totalConfrontos, confrontosAtivos, confrontosEncerrados, jogadores, poolsAtivas };
    },
    listRecentConfrontations(guildId) {
        return client_1.default.confronto.findMany({
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
        const pools = await client_1.default.pool.findMany({
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
        const confrontations = await client_1.default.confronto.findMany({
            where: { guildId, status: 'encerrado' },
            select: {
                timeARoleId: true,
                timeBRoleId: true,
                vencedor: true,
            },
        });
        return confrontations.map(confrontation => ({
            ...confrontation,
            vencedor: confrontation.vencedor,
        }));
    },
};
exports.reportService = createReportService(exports.prismaReportStore);
//# sourceMappingURL=report-service.js.map