"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const veto_1 = require("../systems/veto");
exports.name = discord_js_1.Events.InteractionCreate;
exports.once = false;
async function execute(interaction) {
    if (interaction.isStringSelectMenu()) {
        const [action, confrontoId] = interaction.customId.split(':');
        if (action === 'killer-ban') {
            await (0, veto_1.handleBanSelection)(interaction, Number(confrontoId));
        }
    }
}
//# sourceMappingURL=interactionCreate.js.map