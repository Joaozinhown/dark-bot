"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const player_service_1 = require("../services/player-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra seu perfil e estatisticas')
    .setDMPermission(false);
async function execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const jogador = await player_service_1.playerService.getOrCreate(userId, guildId, interaction.user.displayName);
    const embed = (0, embeds_1.createPerfilEmbed)(interaction.user.displayName, jogador.confrontos, jogador.vitorias, jogador.derrotas);
    await interaction.reply({
        embeds: [embed],
        flags: 64,
    });
}
//# sourceMappingURL=perfil.js.map