"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
exports.name = discord_js_1.Events.VoiceStateUpdate;
exports.once = false;
function execute(oldState, newState) {
    // Logica para detectar quando membros entram/saem dos canais de voz
    // Pode ser usada para notificacoes ou validacoes futuras
}
//# sourceMappingURL=voiceStateUpdate.js.map