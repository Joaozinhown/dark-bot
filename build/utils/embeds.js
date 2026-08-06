"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfrontoEmbed = createConfrontoEmbed;
exports.createVetoEmbed = createVetoEmbed;
exports.createBanEmbed = createBanEmbed;
exports.createSetsReadyEmbed = createSetsReadyEmbed;
exports.createResultadoEmbed = createResultadoEmbed;
exports.createEncerramentoEmbed = createEncerramentoEmbed;
exports.createErrorEmbed = createErrorEmbed;
exports.createSuccessEmbed = createSuccessEmbed;
exports.createListarConfrontosEmbed = createListarConfrontosEmbed;
exports.createRankingEmbed = createRankingEmbed;
exports.createPerfilEmbed = createPerfilEmbed;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const DTA_LOGO = 'https://pxdrop.online/raw/d9fv0fmhv1ts73baugmg?file=queens-trials-logo.png';
function createConfrontoEmbed(confronto, timeAName, timeBName) {
    const poolNum = confronto.poolId;
    const formato = confronto.formato;
    return new discord_js_1.EmbedBuilder()
        .setTitle('QUEENS TRIALS — ALL WIN')
        .setColor(config_1.COLORS.accent)
        .setDescription([
        `**Time A:** ${timeAName}`,
        `**Time B:** ${timeBName}`,
        '',
        `**Pool:** Pool ${poolNum} — ${formato}`,
        `**Formato:** Melhor de ${formato === 'MD3' ? '3' : '5'}`,
        `**Sorteio:** ${confronto.primeiroKiller === 'A' ? timeAName : timeBName} comeca o banimento e joga de Killer no Set 1`,
        '',
        '---',
        '**INICIANDO BANIMENTO DE KILLERS**',
    ].join('\n'))
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createVetoEmbed(action, itensRestantes, timeName, isTiebreak = false) {
    const preview = itensRestantes
        .slice(0, 12)
        .map((item, index) => `**${index + 1}.** ${item}`)
        .join('\n');
    const isPick = action === 'pick';
    const titleAction = isPick ? 'PICK DE KILLER' : (isTiebreak ? 'BANIMENTO PARA TIEBREAK' : 'BANIMENTO DE KILLER');
    const embedColor = isPick ? config_1.COLORS.success : config_1.COLORS.accent;
    const instructionText = isPick
        ? '**Instrução:** Selecione no menu abaixo o Killer que o seu time quer **JOGAR** no set.'
        : '**Instrução:** Selecione no menu abaixo o Killer que você deseja **BANIR** (ele ficará indisponível).';
    return new discord_js_1.EmbedBuilder()
        .setTitle(titleAction)
        .setColor(embedColor)
        .setDescription([
        `**Vez de:** ${timeName}`,
        `**Killers Restantes:** ${itensRestantes.length}`,
        '',
        '**Killers disponiveis:**',
        preview,
        itensRestantes.length > 12 ? `\n...e mais ${itensRestantes.length - 12}` : '',
        '',
        instructionText,
    ].join('\n'))
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createBanEmbed(action, timeName, itemBanido, proximoTimeName, hasMore, isTiebreak = false) {
    const nextStep = hasMore
        ? [
            `**Vez de:** ${proximoTimeName}`,
            '',
            'Aguardando proxima escolha no menu.',
        ]
        : ['Banimento concluido. Preparando os sets...'];
    const title = action === 'pick' ? 'KILLER ESCOLHIDO' : (isTiebreak ? 'KILLER BANIDO (TIEBREAK)' : 'KILLER BANIDO');
    const actVerb = action === 'pick' ? 'escolheu' : 'baniu';
    const embedColor = action === 'pick' ? config_1.COLORS.success : config_1.COLORS.accent;
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setColor(embedColor)
        .setDescription([
        `**${timeName} ${actVerb}:** ${itemBanido}`,
        '',
        ...nextStep,
    ].join('\n'))
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createSetsReadyEmbed(assignments, timeAName, timeBName, timeAPing, timeBPing) {
    const sets = assignments.flatMap(assignment => [
        `**SET ${assignment.numero}**`,
        `Mapa: ${assignment.mapa}`,
        `Killer: ${assignment.killer}`,
        `Quem começa de killer: ${assignment.killerTime === 'A' ? timeAPing : timeBPing}`,
        '',
    ]);
    return new discord_js_1.EmbedBuilder()
        .setTitle('SETS DEFINIDOS')
        .setColor(config_1.COLORS.gold)
        .setDescription([
        `**${timeAName}** x **${timeBName}**`,
        '',
        ...sets,
        'O confronto pode comecar.',
    ].join('\n'))
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createResultadoEmbed(confronto, vencedorName) {
    return new discord_js_1.EmbedBuilder()
        .setTitle(`RESULTADO — CONFRONTO #${confronto.id}`)
        .setColor(config_1.COLORS.gold)
        .setDescription([
        `**VENCEDOR:** ${vencedorName}`,
        '',
        `**Pool ${confronto.pool} — ${confronto.formato}**`,
        `**Placar Final:** ${confronto.timeAVitorias}-${confronto.timeBVitorias}`,
        '',
        '---',
        'Aguardando encerramento...',
    ].join('\n'))
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createEncerramentoEmbed(confrontoId, motivo) {
    return new discord_js_1.EmbedBuilder()
        .setTitle(`CONFRONTO #${confrontoId} ENCERRADO`)
        .setColor(config_1.COLORS.neutral)
        .setDescription(motivo
        ? `**Motivo:** ${motivo}`
        : 'Confronto encerrado pela organizacao.')
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createErrorEmbed(message) {
    return new discord_js_1.EmbedBuilder()
        .setTitle('ERRO')
        .setColor(config_1.COLORS.error)
        .setDescription(message)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createSuccessEmbed(message) {
    return new discord_js_1.EmbedBuilder()
        .setTitle('SUCESSO')
        .setColor(config_1.COLORS.success)
        .setDescription(message)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
function createListarConfrontosEmbed(confrontos) {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('CONFRONTOS ATIVOS')
        .setColor(config_1.COLORS.primary)
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
    if (confrontos.length === 0) {
        embed.setDescription('Nenhum confronto ativo no momento.');
        return embed;
    }
    const description = confrontos
        .map(c => {
        const status = c.status === 'aguardando'
            ? 'Aguardando resultado'
            : c.status === 'em_andamento'
                ? 'Em andamento'
                : c.status;
        return [
            `**#${c.id}** — Pool ${c.poolId} ${c.formato}`,
            `Status: ${status}`,
            `Placar: ${c.timeAVitorias}-${c.timeBVitorias}`,
        ].join('\n');
    })
        .join('\n\n');
    embed.setDescription(description);
    return embed;
}
function createRankingEmbed(ranking) {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('RANKING — QUEENS TRIALS')
        .setColor(config_1.COLORS.gold)
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
    if (ranking.length === 0) {
        embed.setDescription('Nenhum dado de ranking disponivel.');
        return embed;
    }
    const description = ranking
        .map((item, index) => {
        return `**${index + 1}.** ${item.nome} — ${item.vitorias}V / ${item.derrotas}D`;
    })
        .join('\n');
    embed.setDescription(description);
    return embed;
}
function createPerfilEmbed(nome, confrontos, vitorias, derrotas) {
    const winRate = confrontos > 0
        ? ((vitorias / confrontos) * 100).toFixed(1)
        : '0.0';
    return new discord_js_1.EmbedBuilder()
        .setTitle(`PERFIL — ${nome}`)
        .setColor(config_1.COLORS.accent)
        .setDescription([
        `**Confrontos:** ${confrontos}`,
        `**Vitorias:** ${vitorias}`,
        `**Derrotas:** ${derrotas}`,
        `**Win Rate:** ${winRate}%`,
    ].join('\n'))
        .setThumbnail(DTA_LOGO)
        .setFooter({ text: 'Dark Trials Arena' })
        .setTimestamp();
}
//# sourceMappingURL=embeds.js.map