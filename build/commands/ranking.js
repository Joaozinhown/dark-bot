"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const report_service_1 = require("../services/report-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking dos times')
    .setDMPermission(false);
async function execute(interaction) {
    const ranking = await report_service_1.reportService.getRanking(interaction.guildId, async (roleId) => (await interaction.guild.roles.fetch(roleId))?.name ?? null);
    const embed = (0, embeds_1.createRankingEmbed)(ranking);
    await interaction.reply({
        embeds: [embed],
        flags: 64,
    });
}
//# sourceMappingURL=ranking.js.map