"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
exports.name = discord_js_1.Events.ClientReady;
exports.once = true;
function execute(client) {
    console.log(`[Dark Bot] Logado como ${client.user?.tag}`);
    console.log(`[Dark Bot] Servidores: ${client.guilds.cache.size}`);
}
//# sourceMappingURL=ready.js.map