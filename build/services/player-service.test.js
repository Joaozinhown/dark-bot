"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const player_service_1 = require("./player-service");
function createStore(initial) {
    return {
        created: undefined,
        async find(userId, guildId) {
            return initial?.id === userId && initial.guildId === guildId ? initial : null;
        },
        async create(input) {
            this.created = input;
            return { ...input, vitorias: 0, derrotas: 0, confrontos: 0 };
        },
    };
}
(0, node_test_1.default)('returns an existing player scoped to user and guild', async () => {
    const existing = {
        id: 'user-1', guildId: 'guild-1', nome: 'Queen', vitorias: 2, derrotas: 1, confrontos: 3,
    };
    const service = (0, player_service_1.createPlayerService)(createStore(existing));
    strict_1.default.equal(await service.getOrCreate('user-1', 'guild-1', 'Changed'), existing);
});
(0, node_test_1.default)('creates a zeroed player when no guild profile exists', async () => {
    const store = createStore(null);
    const service = (0, player_service_1.createPlayerService)(store);
    const player = await service.getOrCreate('user-1', 'guild-2', 'Queen');
    strict_1.default.deepEqual(store.created, { id: 'user-1', guildId: 'guild-2', nome: 'Queen' });
    strict_1.default.deepEqual(player, {
        id: 'user-1', guildId: 'guild-2', nome: 'Queen', vitorias: 0, derrotas: 0, confrontos: 0,
    });
});
//# sourceMappingURL=player-service.test.js.map