"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const veto_selection_service_1 = require("./veto-selection-service");
const BASE_INPUT = {
    guildId: '100000000000000001',
    channelId: '100000000000000002',
    confrontationId: 42,
    format: 'MD3',
    stepIndex: 4,
    turn: 'A',
    messageId: '100000000000000003',
    killersSerialized: '["Artist","Nurse","Spirit"]',
    pickedKillersSerialized: '[]',
    killer: 'Nurse',
    actor: {
        userId: '100000000000000004',
        username: 'player.one',
        displayName: 'Player One',
        teamSide: 'A',
        teamRoleId: '100000000000000005',
        teamRoleName: 'Team Alpha',
    },
};
function createStore(commitResult = true) {
    const commits = [];
    const store = {
        async commit(input) {
            commits.push(structuredClone(input));
            return commitResult;
        },
    };
    return { store, commits };
}
(0, node_test_1.default)('commits a pick and its actor audit payload atomically', async () => {
    const { store, commits } = createStore();
    const service = (0, veto_selection_service_1.createVetoSelectionService)(store);
    const result = await service.select(BASE_INPUT);
    strict_1.default.equal(result.action, 'pick');
    strict_1.default.equal(result.setNumber, 1);
    strict_1.default.deepEqual(result.remainingKillers, ['Artist', 'Spirit']);
    strict_1.default.deepEqual(result.pickedKillers, ['Nurse']);
    strict_1.default.equal(result.nextTurn, 'B');
    strict_1.default.deepEqual(commits, [{
            expected: {
                confrontationId: 42,
                stepIndex: 4,
                turn: 'A',
                messageId: '100000000000000003',
                killersSerialized: '["Artist","Nurse","Spirit"]',
                pickedKillersSerialized: '[]',
            },
            next: {
                stepIndex: 5,
                turn: 'B',
                killersSerialized: '["Artist","Spirit"]',
                pickedKillersSerialized: '["Nurse"]',
                messageId: null,
            },
            audit: {
                guildId: '100000000000000001',
                actorUserId: '100000000000000004',
                action: 'veto.pick',
                entityType: 'confrontation',
                entityId: '42',
                details: {
                    actorDisplayName: 'Player One',
                    actorUsername: 'player.one',
                    channelId: '100000000000000002',
                    killer: 'Nurse',
                    messageId: '100000000000000003',
                    setNumber: 1,
                    teamRoleId: '100000000000000005',
                    teamRoleName: 'Team Alpha',
                    teamSide: 'A',
                    vetoStep: 5,
                },
            },
        }]);
});
(0, node_test_1.default)('records a ban without assigning it to a set', async () => {
    const { store, commits } = createStore();
    const service = (0, veto_selection_service_1.createVetoSelectionService)(store);
    const result = await service.select({ ...BASE_INPUT, stepIndex: 0 });
    strict_1.default.equal(result.action, 'ban');
    strict_1.default.equal(result.setNumber, null);
    strict_1.default.equal(commits[0].audit.action, 'veto.ban');
    strict_1.default.equal(commits[0].audit.details.setNumber, null);
    strict_1.default.deepEqual(result.pickedKillers, []);
});
(0, node_test_1.default)('rejects unavailable killers and the wrong team without writing audit', async () => {
    const { store, commits } = createStore();
    const service = (0, veto_selection_service_1.createVetoSelectionService)(store);
    await strict_1.default.rejects(service.select({ ...BASE_INPUT, killer: 'Clown' }), (error) => error instanceof veto_selection_service_1.VetoSelectionServiceError
        && error.code === 'KILLER_UNAVAILABLE');
    await strict_1.default.rejects(service.select({ ...BASE_INPUT, actor: { ...BASE_INPUT.actor, teamSide: 'B' } }), (error) => error instanceof veto_selection_service_1.VetoSelectionServiceError
        && error.code === 'WRONG_TEAM');
    strict_1.default.deepEqual(commits, []);
});
(0, node_test_1.default)('reports a stale selection when the conditional transaction loses the race', async () => {
    const { store, commits } = createStore(false);
    const service = (0, veto_selection_service_1.createVetoSelectionService)(store);
    await strict_1.default.rejects(service.select(BASE_INPUT), (error) => error instanceof veto_selection_service_1.VetoSelectionServiceError
        && error.code === 'STALE_STATE');
    strict_1.default.equal(commits.length, 1);
});
(0, node_test_1.default)('rejects malformed serialized state before calling the store', async () => {
    const { store, commits } = createStore();
    const service = (0, veto_selection_service_1.createVetoSelectionService)(store);
    await strict_1.default.rejects(service.select({ ...BASE_INPUT, killersSerialized: '{}' }), (error) => error instanceof veto_selection_service_1.VetoSelectionServiceError
        && error.code === 'INVALID_STATE');
    strict_1.default.deepEqual(commits, []);
});
//# sourceMappingURL=veto-selection-service.test.js.map