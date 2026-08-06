"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMOJIS = exports.COLORS = void 0;
exports.getPoolById = getPoolById;
exports.getPoolsAtivas = getPoolsAtivas;
exports.getVitoriasNecessarias = getVitoriasNecessarias;
exports.getSetsMaximos = getSetsMaximos;
const client_1 = __importDefault(require("./database/client"));
exports.COLORS = {
    primary: '#0a0a14',
    secondary: '#1a1a2e',
    accent: '#dc143c',
    gold: '#c9a227',
    success: '#2ecc71',
    warning: '#f39c12',
    error: '#e74c3c',
    neutral: '#95a5a6',
    text: '#ffffff',
    textMuted: '#b9bbbe',
};
exports.EMOJIS = {
    ban: 'X',
    check: 'OK',
    vs: 'VS',
};
async function getPoolById(id, guildId) {
    const pool = await client_1.default.pool.findFirst({
        where: {
            id,
            guildId,
            ativa: true,
        },
        include: {
            mapas: { orderBy: { ordem: 'asc' } },
            killers: { orderBy: { ordem: 'asc' } },
        },
    });
    if (!pool)
        return null;
    return {
        id: pool.id,
        formato: pool.formato,
        mapas: pool.mapas.map(m => m.nome),
        killers: pool.killers.map(k => k.nome),
    };
}
async function getPoolsAtivas(guildId) {
    const pools = await client_1.default.pool.findMany({
        where: {
            guildId,
            ativa: true,
        },
        include: {
            mapas: { orderBy: { ordem: 'asc' } },
            killers: { orderBy: { ordem: 'asc' } },
        },
        orderBy: { id: 'asc' },
    });
    return pools.map(pool => ({
        id: pool.id,
        formato: pool.formato,
        mapas: pool.mapas.map(m => m.nome),
        killers: pool.killers.map(k => k.nome),
    }));
}
function getVitoriasNecessarias(formato) {
    return formato === 'MD3' ? 2 : 3;
}
function getSetsMaximos(formato) {
    return formato === 'MD3' ? 3 : 5;
}
//# sourceMappingURL=config.js.map