"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const confrontation_service_1 = require("./confrontation-service");
const pool = {
    id: 4,
    guildId: 'guild-1',
    formato: 'MD3',
    ativa: true,
    mapas: ['Map 1', 'Map 2', 'Map 3'],
    killers: ['K1', 'K2', 'K3', 'K4'],
};
const confrontation = {
    id: 9,
    guildId: 'guild-1',
    poolId: 4,
    formato: 'MD3',
    timeARoleId: 'role-a',
    timeBRoleId: 'role-b',
    timeAVitorias: 0,
    timeBVitorias: 0,
    status: 'veto',
    currentSet: 1,
    channelId: 'channel-1',
    vozTimeAId: null,
    vozTimeBId: null,
    vencedor: null,
    primeiroKiller: 'A',
    encerradoEm: null,
    motivoEncerramento: null,
    criadoEm: new Date('2026-07-28T12:00:00.000Z'),
};
function createStore(overrides = {}) {
    return {
        findPool: async () => pool,
        create: async (input) => ({ ...confrontation, ...input }),
        findById: async () => confrontation,
        recordResult: async (_id, _guildId, winner) => ({
            ...confrontation,
            vencedor: winner,
            timeAVitorias: winner === 'A' ? confrontation.timeAVitorias + 1 : confrontation.timeAVitorias,
            timeBVitorias: winner === 'B' ? confrontation.timeBVitorias + 1 : confrontation.timeBVitorias,
            status: 'resultado',
        }),
        close: async (_id, _guildId, reason, closedAt) => ({
            ...confrontation,
            status: 'encerrado',
            motivoEncerramento: reason,
            encerradoEm: closedAt,
        }),
        listActive: async () => [confrontation],
        ...overrides,
    };
}
(0, node_test_1.default)('creates a confrontation in the invoking channel with a deterministic draw', async () => {
    let receivedInput;
    const service = (0, confrontation_service_1.createConfrontationService)(createStore({
        create: async (input) => {
            receivedInput = input;
            return { ...confrontation, ...input };
        },
    }), () => 0.99);
    const result = await service.create({
        guildId: 'guild-1',
        poolId: 4,
        timeARoleId: 'role-a',
        timeBRoleId: 'role-b',
        channelId: 'channel-1',
    });
    strict_1.default.equal(result.primeiroKiller, 'B');
    strict_1.default.deepEqual(receivedInput, {
        guildId: 'guild-1',
        poolId: 4,
        formato: 'MD3',
        timeARoleId: 'role-a',
        timeBRoleId: 'role-b',
        primeiroKiller: 'B',
        status: 'veto',
        channelId: 'channel-1',
    });
});
(0, node_test_1.default)('acknowledges the Discord interaction before persisting a confrontation', async () => {
    const events = [];
    const service = (0, confrontation_service_1.createConfrontationService)(createStore({
        create: async (input) => {
            events.push('persist');
            return { ...confrontation, ...input };
        },
    }));
    await service.create({
        guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }, async () => { events.push('defer'); });
    strict_1.default.deepEqual(events, ['defer', 'persist']);
});
(0, node_test_1.default)('rejects invalid pools and duplicate teams before creating', async () => {
    const missingPool = (0, confrontation_service_1.createConfrontationService)(createStore({ findPool: async () => null }));
    await strict_1.default.rejects(missingPool.create({
        guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }), (error) => error instanceof confrontation_service_1.ConfrontationServiceError && error.code === 'POOL_NOT_FOUND');
    const service = (0, confrontation_service_1.createConfrontationService)(createStore());
    await strict_1.default.rejects(service.create({
        guildId: 'guild-1', poolId: 4, timeARoleId: 'same', timeBRoleId: 'same', channelId: 'c',
    }), (error) => error instanceof confrontation_service_1.ConfrontationServiceError && error.code === 'SAME_TEAM');
});
(0, node_test_1.default)('validates preset map and killer counts', async () => {
    const invalidMaps = (0, confrontation_service_1.createConfrontationService)(createStore({
        findPool: async () => ({ ...pool, mapas: ['Map 1'] }),
    }));
    await strict_1.default.rejects(invalidMaps.create({
        guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }), (error) => error instanceof confrontation_service_1.ConfrontationServiceError && error.code === 'INVALID_MAP_COUNT');
    const invalidKillers = (0, confrontation_service_1.createConfrontationService)(createStore({
        findPool: async () => ({ ...pool, killers: ['K1', 'K2', 'K3'] }),
    }));
    await strict_1.default.rejects(invalidKillers.create({
        guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }), (error) => error instanceof confrontation_service_1.ConfrontationServiceError && error.code === 'INSUFFICIENT_KILLERS');
});
(0, node_test_1.default)('records a participating winner and increments only that team', async () => {
    let resultInput;
    const service = (0, confrontation_service_1.createConfrontationService)(createStore({
        recordResult: async (id, guildId, winner) => {
            resultInput = { id, guildId, winner };
            return { ...confrontation, vencedor: winner, status: 'resultado', timeBVitorias: 1 };
        },
    }));
    const result = await service.recordResult(9, 'role-b', 'guild-1');
    strict_1.default.equal(result.winner, 'B');
    strict_1.default.deepEqual(resultInput, { id: 9, guildId: 'guild-1', winner: 'B' });
});
(0, node_test_1.default)('rejects results for unknown, closed, or non-participating confrontations', async () => {
    const missing = (0, confrontation_service_1.createConfrontationService)(createStore({ findById: async () => null }));
    await strict_1.default.rejects(missing.recordResult(99, 'role-a', 'guild-1'), { code: 'NOT_FOUND' });
    const closed = (0, confrontation_service_1.createConfrontationService)(createStore({
        findById: async () => ({ ...confrontation, status: 'encerrado' }),
    }));
    await strict_1.default.rejects(closed.recordResult(9, 'role-a', 'guild-1'), { code: 'ALREADY_CLOSED' });
    const outsider = (0, confrontation_service_1.createConfrontationService)(createStore());
    await strict_1.default.rejects(outsider.recordResult(9, 'other-role', 'guild-1'), { code: 'INVALID_WINNER' });
});
(0, node_test_1.default)('closes an active confrontation and lists only guild active records', async () => {
    let closeInput;
    let listedGuild;
    const service = (0, confrontation_service_1.createConfrontationService)(createStore({
        close: async (id, guildId, reason, closedAt) => {
            closeInput = { id, guildId, reason, closedAt };
            return { ...confrontation, status: 'encerrado', motivoEncerramento: reason, encerradoEm: closedAt };
        },
        listActive: async (guildId) => {
            listedGuild = guildId;
            return [confrontation];
        },
    }));
    const closed = await service.close(9, 'fim', 'guild-1');
    const listed = await service.listActive('guild-1');
    strict_1.default.equal(closed.status, 'encerrado');
    strict_1.default.equal(closeInput.reason, 'fim');
    strict_1.default.equal(closeInput.closedAt instanceof Date, true);
    strict_1.default.equal(listedGuild, 'guild-1');
    strict_1.default.deepEqual(listed, [confrontation]);
});
(0, node_test_1.default)('reports a concurrent close instead of overwriting it', async () => {
    const service = (0, confrontation_service_1.createConfrontationService)(createStore({ close: async () => null }));
    await strict_1.default.rejects(service.close(9, 'fim', 'guild-1'), (error) => error instanceof confrontation_service_1.ConfrontationServiceError && error.code === 'ALREADY_CLOSED');
});
(0, node_test_1.default)('reports a concurrent close while recording a result', async () => {
    const service = (0, confrontation_service_1.createConfrontationService)(createStore({ recordResult: async () => null }));
    await strict_1.default.rejects(service.recordResult(9, 'role-a', 'guild-1'), (error) => error instanceof confrontation_service_1.ConfrontationServiceError && error.code === 'ALREADY_CLOSED');
});
//# sourceMappingURL=confrontation-service.test.js.map