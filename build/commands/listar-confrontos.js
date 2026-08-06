"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const confrontation_service_1 = require("../services/confrontation-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('listar-confrontos')
    .setDescription('Lista confrontos ativos e recentes')
    .setDMPermission(false);
async function execute(interaction) {
    const confrontos = await confrontation_service_1.confrontationService.listActive(interaction.guildId);
    const confrontosData = confrontos.map(c => ({
        ...c,
        formato: c.formato,
        vencedor: c.vencedor,
        primeiroKiller: c.primeiroKiller,
    }));
    const embed = (0, embeds_1.createListarConfrontosEmbed)(confrontosData);
    await interaction.reply({
        embeds: [embed],
        flags: 64,
    });
}
//# sourceMappingURL=listar-confrontos.js.map