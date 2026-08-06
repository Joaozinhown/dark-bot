"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerService = void 0;
exports.createPlayerService = createPlayerService;
const client_1 = __importDefault(require("../database/client"));
function createPlayerService(store) {
    return {
        async getOrCreate(userId, guildId, displayName) {
            const existing = await store.find(userId, guildId);
            if (existing)
                return existing;
            return store.create({ id: userId, guildId, nome: displayName });
        },
    };
}
const prismaPlayerStore = {
    find: (userId, guildId) => client_1.default.jogador.findUnique({
        where: { id_guildId: { id: userId, guildId } },
    }),
    create: input => client_1.default.jogador.create({ data: input }),
};
exports.playerService = createPlayerService(prismaPlayerStore);
//# sourceMappingURL=player-service.js.map