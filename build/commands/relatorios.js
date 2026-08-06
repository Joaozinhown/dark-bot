"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const report_service_1 = require("../services/report-service");
const DTA_LOGO = 'https://pxdrop.online/raw/d9fv0fmhv1ts73baugmg?file=queens-trials-logo.png';
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('relatorios')
    .setDescription('Mostra relatorios operacionais do torneio')
    .setDMPermission(false)
    .addSubcommand(subcommand => subcommand
    .setName('resumo')
    .setDescription('Mostra resumo geral do servidor'))
    .addSubcommand(subcommand => subcommand
    .setName('confrontos')
    .setDescription('Mostra ultimos confrontos registrados'))
    .addSubcommand(subcommand => subcommand
    .setName('pools')
    .setDescription('Mostra status das pools configuradas'));
async function execute(interaction) {
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'confrontos') {
        await handleConfrontos(interaction, guildId);
        return;
    }
    if (subcommand === 'pools') {
        await handlePools(interaction, guildId);
        return;
    }
    await handleResumo(interaction, guildId);
}
async function handleResumo(interaction, guildId) {
    const { totalConfrontos, confrontosAtivos, confrontosEncerrados, jogadores, poolsAtivas, } = await report_service_1.reportService.getSummary(guildId);
    const embed = baseReportEmbed('RELATORIO — RESUMO')
        .setDescription([
        `**Confrontos totais:** ${totalConfrontos}`,
        `**Confrontos ativos:** ${confrontosAtivos}`,
        `**Confrontos encerrados:** ${confrontosEncerrados}`,
        `**Jogadores com perfil:** ${jogadores}`,
        `**Pools ativas:** ${poolsAtivas}`,
    ].join('\n'));
    await interaction.reply({ embeds: [embed], flags: 64 });
}
async function handleConfrontos(interaction, guildId) {
    const confrontos = await report_service_1.reportService.listRecentConfrontations(guildId);
    const embed = baseReportEmbed('RELATORIO — CONFRONTOS');
    if (confrontos.length === 0) {
        embed.setDescription('Nenhum confronto registrado neste servidor.');
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    embed.setDescription(confrontos.map(confronto => [
        `**#${confronto.id}** — ${confronto.formato}`,
        `Status: ${confronto.status}`,
        `Placar: ${confronto.timeAVitorias}-${confronto.timeBVitorias}`,
        `Criado: <t:${Math.floor(confronto.criadoEm.getTime() / 1000)}:R>`,
    ].join('\n')).join('\n\n'));
    await interaction.reply({ embeds: [embed], flags: 64 });
}
async function handlePools(interaction, guildId) {
    const pools = await report_service_1.reportService.listPoolReports(guildId);
    const embed = baseReportEmbed('RELATORIO — POOLS');
    if (pools.length === 0) {
        embed.setDescription('Nenhuma pool configurada neste servidor.');
        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
    }
    embed.setDescription(pools.map(pool => [
        `**${pool.nome}** (ID: ${pool.id}) — ${pool.ativa ? 'Ativa' : 'Inativa'}`,
        `Formato: ${pool.formato}`,
        `Mapas: ${pool.mapas}`,
        `Killers: ${pool.killers}`,
        `Confrontos: ${pool.confrontos}`,
    ].join('\n')).join('\n\n'));
    await interaction.reply({ embeds: [embed], flags: 64 });
}
function baseReportEmbed(title) {
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setColor(config_1.COLORS.accent)
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
//# sourceMappingURL=relatorios.js.map