"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const veto_rules_1 = require("./veto-rules");
const pool_presets_1 = require("../data/pool-presets");
(0, node_test_1.default)('draws each team from opposite halves of the random range', () => {
    strict_1.default.equal((0, veto_rules_1.drawStartingTeam)(() => 0), 'A');
    strict_1.default.equal((0, veto_rules_1.drawStartingTeam)(() => 0.999), 'B');
});
(0, node_test_1.default)('alternates the killer team from the drawn starter', () => {
    strict_1.default.equal((0, veto_rules_1.getKillerTeamForSet)('A', 1), 'A');
    strict_1.default.equal((0, veto_rules_1.getKillerTeamForSet)('A', 2), 'B');
    strict_1.default.equal((0, veto_rules_1.getKillerTeamForSet)('A', 3), 'A');
    strict_1.default.equal((0, veto_rules_1.getKillerTeamForSet)('B', 1), 'B');
});
(0, node_test_1.default)('classifies every MD3 veto step and marks tiebreak bans', () => {
    strict_1.default.deepEqual(Array.from({ length: 8 }, (_, stepIndex) => (0, veto_rules_1.getVetoAction)('MD3', stepIndex)), [
        { action: 'ban', isTiebreak: false },
        { action: 'ban', isTiebreak: false },
        { action: 'ban', isTiebreak: false },
        { action: 'ban', isTiebreak: false },
        { action: 'pick', isTiebreak: false },
        { action: 'pick', isTiebreak: false },
        { action: 'ban', isTiebreak: true },
        { action: 'ban', isTiebreak: true },
    ]);
});
(0, node_test_1.default)('classifies every MD5 veto step and assigns set numbers only to picks', () => {
    const actions = Array.from({ length: 10 }, (_, stepIndex) => (0, veto_rules_1.getVetoAction)('MD5', stepIndex));
    strict_1.default.deepEqual(actions, [
        { action: 'ban', isTiebreak: false },
        { action: 'ban', isTiebreak: false },
        { action: 'pick', isTiebreak: false },
        { action: 'pick', isTiebreak: false },
        { action: 'ban', isTiebreak: false },
        { action: 'ban', isTiebreak: false },
        { action: 'pick', isTiebreak: false },
        { action: 'pick', isTiebreak: false },
        { action: 'ban', isTiebreak: true },
        { action: 'ban', isTiebreak: true },
    ]);
    strict_1.default.equal((0, veto_rules_1.getPickSetNumber)('ban', 0), null);
    strict_1.default.equal((0, veto_rules_1.getPickSetNumber)('pick', 0), 1);
    strict_1.default.equal((0, veto_rules_1.getPickSetNumber)('pick', 3), 4);
});
(0, node_test_1.default)('pairs remaining killers with preset maps in pool order', () => {
    strict_1.default.deepEqual((0, veto_rules_1.createSetAssignments)(['Map 1', 'Map 2', 'Map 3'], ['Killer 1', 'Killer 2', 'Killer 3'], 'B'), [
        { numero: 1, mapa: 'Map 1', killer: 'Killer 1', killerTime: 'B' },
        { numero: 2, mapa: 'Map 2', killer: 'Killer 2', killerTime: 'A' },
        { numero: 3, mapa: 'Map 3', killer: 'Killer 3', killerTime: 'B' },
    ]);
});
(0, node_test_1.default)('rejects incomplete killer selections', () => {
    strict_1.default.throws(() => (0, veto_rules_1.createSetAssignments)(['Map 1', 'Map 2'], ['Killer 1'], 'A'), /um killer por mapa/i);
});
(0, node_test_1.default)('each preset pool requires exactly six killer bans', () => {
    for (const pool of pool_presets_1.POOL_PRESETS) {
        strict_1.default.equal(pool.killers.length - pool.mapas.length, 6);
    }
});
(0, node_test_1.default)('exposes the three tournament pools in order', () => {
    strict_1.default.deepEqual(pool_presets_1.POOL_PRESETS.map(pool => [pool.nome, pool.formato]), [
        ['Queens Trials 1', 'MD3'],
        ['Queens Trials 2', 'MD5'],
        ['Queens Trials 3', 'MD5'],
    ]);
});
//# sourceMappingURL=veto-rules.test.js.map