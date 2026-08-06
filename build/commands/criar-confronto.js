"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const veto_1 = require("../systems/veto");
const confrontation_service_1 = require("../services/confrontation-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('criar-confronto')
    .setDescription('Cria um confronto entre dois times')
    .setDMPermission(false)
    .addIntegerOption(option => option
    .setName('pool-id')
    .setDescription('ID da pool (use /gerenciar-pool listar para ver IDs)')
    .setRequired(true))
    .addRoleOption(option => option
    .setName('time-a')
    .setDescription('Cargo do Time A')
    .setRequired(true))
    .addRoleOption(option => option
    .setName('time-b')
    .setDescription('Cargo do Time B')
    .setRequired(true));
async function execute(interaction) {
    const poolId = interaction.options.getInteger('pool-id', true);
    const timeA = interaction.options.getRole('time-a', true);
    const timeB = interaction.options.getRole('time-b', true);
    if (!(interaction.channel instanceof discord_js_1.TextChannel)) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Use este comando em um canal de texto do confronto.')],
            flags: 64,
        });
        return;
    }
    const textChannel = interaction.channel;
    let created;
    try {
        created = await confrontation_service_1.confrontationService.create({
            guildId: interaction.guildId,
            poolId,
            timeARoleId: timeA.id,
            timeBRoleId: timeB.id,
            channelId: textChannel.id,
        }, () => interaction.deferReply());
    }
    catch (error) {
        if (!(error instanceof confrontation_service_1.ConfrontationServiceError))
            throw error;
        const message = error.code === 'POOL_NOT_FOUND'
            ? 'Pool nao encontrada ou inativa. Use `/gerenciar-pool listar` para ver pools disponiveis.'
            : error.message;
        await interaction.reply({ embeds: [(0, embeds_1.createErrorEmbed)(message)], flags: 64 });
        return;
    }
    const { poolConfig, ...confronto } = created;
    const primeiroKiller = confronto.primeiroKiller;
    const confrontoData = {
        ...confronto,
        pool: poolId,
        channelId: textChannel.id,
        formato: confronto.formato,
        vencedor: confronto.vencedor,
        primeiroKiller: confronto.primeiroKiller,
    };
    const embed = (0, embeds_1.createConfrontoEmbed)(confrontoData, timeA.name, timeB.name);
    // Coin toss animation
    await interaction.editReply({ content: '🪙 **Lançando a moeda...**' });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await interaction.editReply({ content: '🪙 **A moeda está no ar...**' });
    await new Promise(resolve => setTimeout(resolve, 1500));
    const winnerName = primeiroKiller === 'A' ? timeA.name : timeB.name;
    await interaction.editReply({
        content: `🪙 Cara ou Coroa finalizado! O time **${winnerName}** venceu e começará de Killer!`,
        embeds: [embed]
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await (0, veto_1.startVeto)(interaction.guild, confronto.id, poolConfig, primeiroKiller, textChannel);
}
//# sourceMappingURL=criar-confronto.js.map