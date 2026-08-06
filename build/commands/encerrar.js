"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const channels_1 = require("../utils/channels");
const embeds_1 = require("../utils/embeds");
const confrontation_service_1 = require("../services/confrontation-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('encerrar')
    .setDescription('Encerra um confronto e limpa canais')
    .setDMPermission(false)
    .addIntegerOption(option => option
    .setName('confronto-id')
    .setDescription('ID do confronto')
    .setRequired(true))
    .addStringOption(option => option
    .setName('motivo')
    .setDescription('Motivo do encerramento'));
async function execute(interaction) {
    const confrontoId = interaction.options.getInteger('confronto-id', true);
    const motivo = interaction.options.getString('motivo');
    let confronto;
    try {
        confronto = await confrontation_service_1.confrontationService.close(confrontoId, motivo, interaction.guildId, () => interaction.deferReply());
    }
    catch (error) {
        if (!(error instanceof confrontation_service_1.ConfrontationServiceError))
            throw error;
        await interaction.reply({ embeds: [(0, embeds_1.createErrorEmbed)(error.message)], flags: 64 });
        return;
    }
    await (0, channels_1.deleteConfrontoVoiceChannels)(interaction.guild, confronto.vozTimeAId, confronto.vozTimeBId);
    const embed = (0, embeds_1.createEncerramentoEmbed)(confrontoId, motivo ?? undefined);
    await interaction.editReply({
        embeds: [embed],
    });
}
//# sourceMappingURL=encerrar.js.map