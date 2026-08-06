"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const confrontation_service_1 = require("../services/confrontation-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('resultado')
    .setDescription('Registra o vencedor do confronto')
    .setDMPermission(false)
    .addIntegerOption(option => option
    .setName('confronto-id')
    .setDescription('ID do confronto')
    .setRequired(true))
    .addRoleOption(option => option
    .setName('vencedor')
    .setDescription('Time vencedor do confronto')
    .setRequired(true));
async function execute(interaction) {
    const confrontoId = interaction.options.getInteger('confronto-id', true);
    const vencedor = interaction.options.getRole('vencedor', true);
    let result;
    try {
        result = await confrontation_service_1.confrontationService.recordResult(confrontoId, vencedor.id, interaction.guildId);
    }
    catch (error) {
        if (!(error instanceof confrontation_service_1.ConfrontationServiceError))
            throw error;
        await interaction.reply({ embeds: [(0, embeds_1.createErrorEmbed)(error.message)], flags: 64 });
        return;
    }
    const confronto = result.previous;
    const vencedorTime = result.winner;
    const confrontoData = {
        ...confronto,
        vencedor: vencedorTime,
        formato: confronto.formato,
        primeiroKiller: confronto.primeiroKiller,
    };
    const embed = (0, embeds_1.createResultadoEmbed)(confrontoData, vencedor.name);
    if (confronto.channelId) {
        const canal = await interaction.guild.channels.fetch(confronto.channelId);
        if (canal?.isTextBased()) {
            await canal.send({ embeds: [embed] });
        }
    }
    await interaction.reply({
        embeds: [embed],
        flags: 64,
    });
}
//# sourceMappingURL=resultado.js.map