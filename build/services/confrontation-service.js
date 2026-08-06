"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confrontationService = exports.prismaConfrontationStore = exports.ConfrontationServiceError = void 0;
exports.createConfrontationService = createConfrontationService;
const client_1 = __importDefault(require("../database/client"));
const config_1 = require("../config");
const veto_rules_1 = require("../systems/veto-rules");
class ConfrontationServiceError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ConfrontationServiceError';
    }
}
exports.ConfrontationServiceError = ConfrontationServiceError;
function toConfrontationRecord(record) {
    return {
        ...record,
        formato: record.formato,
        vencedor: record.vencedor,
        primeiroKiller: record.primeiroKiller,
    };
}
exports.prismaConfrontationStore = {
    async findPool(guildId, poolId) {
        const pool = await client_1.default.pool.findFirst({
            where: { id: poolId, guildId, ativa: true },
            include: {
                mapas: { orderBy: { ordem: 'asc' } },
                killers: { orderBy: { ordem: 'asc' } },
            },
        });
        if (!pool)
            return null;
        return {
            id: pool.id,
            guildId: pool.guildId,
            formato: pool.formato,
            ativa: pool.ativa,
            mapas: pool.mapas.map(item => item.nome),
            killers: pool.killers.map(item => item.nome),
        };
    },
    async create(input) {
        const record = await client_1.default.confronto.create({ data: input });
        return toConfrontationRecord(record);
    },
    async findById(id, guildId) {
        const record = await client_1.default.confronto.findFirst({ where: { id, guildId } });
        return record ? toConfrontationRecord(record) : null;
    },
    async recordResult(id, guildId, winner) {
        return client_1.default.$transaction(async (transaction) => {
            const result = await transaction.confronto.updateMany({
                where: { id, guildId, status: { not: 'encerrado' } },
                data: {
                    vencedor: winner,
                    timeAVitorias: winner === 'A' ? { increment: 1 } : undefined,
                    timeBVitorias: winner === 'B' ? { increment: 1 } : undefined,
                    status: 'resultado',
                },
            });
            if (result.count !== 1)
                return null;
            const updated = await transaction.confronto.findFirstOrThrow({ where: { id, guildId } });
            return toConfrontationRecord(updated);
        });
    },
    async close(id, guildId, reason, closedAt) {
        return client_1.default.$transaction(async (transaction) => {
            const result = await transaction.confronto.updateMany({
                where: { id, guildId, status: { not: 'encerrado' } },
                data: {
                    status: 'encerrado',
                    encerradoEm: closedAt,
                    motivoEncerramento: reason,
                },
            });
            if (result.count !== 1)
                return null;
            const updated = await transaction.confronto.findFirstOrThrow({ where: { id, guildId } });
            return toConfrontationRecord(updated);
        });
    },
    async listActive(guildId) {
        const records = await client_1.default.confronto.findMany({
            where: { guildId, status: { not: 'encerrado' } },
            orderBy: { criadoEm: 'desc' },
            take: 10,
        });
        return records.map(toConfrontationRecord);
    },
};
function createConfrontationService(store = exports.prismaConfrontationStore, random = Math.random) {
    async function prepareCreate(input) {
        const pool = await store.findPool(input.guildId, input.poolId);
        if (!pool) {
            throw new ConfrontationServiceError('POOL_NOT_FOUND', 'Pool nao encontrada ou inativa.');
        }
        const maximumSets = (0, config_1.getSetsMaximos)(pool.formato);
        if (pool.mapas.length !== maximumSets) {
            throw new ConfrontationServiceError('INVALID_MAP_COUNT', `A pool ${pool.formato} precisa ter exatamente ${maximumSets} mapas presetados.`);
        }
        if (pool.killers.length <= maximumSets) {
            throw new ConfrontationServiceError('INSUFFICIENT_KILLERS', `A pool precisa ter mais de ${maximumSets} killers para permitir bans.`);
        }
        if (input.timeARoleId === input.timeBRoleId) {
            throw new ConfrontationServiceError('SAME_TEAM', 'Os times devem ser diferentes.');
        }
        return {
            record: {
                ...input,
                formato: pool.formato,
                primeiroKiller: (0, veto_rules_1.drawStartingTeam)(random),
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
    async function createPrepared(prepared) {
        const confrontation = await store.create(prepared.record);
        return { ...confrontation, poolConfig: prepared.poolConfig };
    }
    async function prepareClose(id, guildId) {
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
        async create(input, beforeCommit = async () => undefined) {
            const prepared = await prepareCreate(input);
            await beforeCommit();
            return createPrepared(prepared);
        },
        async recordResult(id, winnerRoleId, guildId) {
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
            const winner = winnerRoleId === confrontation.timeARoleId ? 'A' : 'B';
            const updated = await store.recordResult(id, guildId, winner);
            if (!updated) {
                throw new ConfrontationServiceError('ALREADY_CLOSED', 'Este confronto ja foi encerrado.');
            }
            return { previous: confrontation, updated, winner };
        },
        async close(id, reason, guildId, beforeCommit = async () => undefined) {
            const confrontation = await prepareClose(id, guildId);
            await beforeCommit();
            const closed = await store.close(confrontation.id, guildId, reason, new Date());
            if (!closed) {
                throw new ConfrontationServiceError('ALREADY_CLOSED', 'Este confronto ja foi encerrado.');
            }
            return closed;
        },
        listActive(guildId) {
            return store.listActive(guildId);
        },
    };
}
exports.confrontationService = createConfrontationService();
//# sourceMappingURL=confrontation-service.js.map