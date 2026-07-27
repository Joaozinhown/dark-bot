import { EmbedBuilder, Colors } from 'discord.js';
import { COLORS } from '../config';
import { ConfrontoData, PoolFormato } from '../types/index';
import { SetAssignment } from '../systems/veto-rules';

const DTA_LOGO = 'https://pxdrop.online/raw/d9fv0fmhv1ts73baugmg?file=queens-trials-logo.png';

export function createConfrontoEmbed(
  confronto: ConfrontoData,
  timeAName: string,
  timeBName: string,
): EmbedBuilder {
  const poolNum = confronto.poolId;
  const formato = confronto.formato;

  return new EmbedBuilder()
    .setTitle('QUEENS TRIALS — ALL WIN')
    .setColor(COLORS.accent as any)
    .setDescription(
      [
        `**Time A:** ${timeAName}`,
        `**Time B:** ${timeBName}`,
        '',
        `**Pool:** Pool ${poolNum} — ${formato}`,
        `**Formato:** Melhor de ${formato === 'MD3' ? '3' : '5'}`,
        `**Sorteio:** ${confronto.primeiroKiller === 'A' ? timeAName : timeBName} comeca o banimento e joga de Killer no Set 1`,
        '',
        '---',
        '**INICIANDO BANIMENTO DE KILLERS**',
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createVetoEmbed(
  action: string,
  itensRestantes: string[],
  timeName: string,
): EmbedBuilder {
  const preview = itensRestantes
    .slice(0, 12)
    .map((item, index) => `**${index + 1}.** ${item}`)
    .join('\n');

  const titleAction = action === 'pick' ? 'PICK DE KILLER' : 'BANIMENTO DE KILLER';
  const actionText = action === 'pick' ? 'escolha' : 'banimento';
  const embedColor = action === 'pick' ? COLORS.success : COLORS.accent;

  const instructionText = action === 'pick'
    ? '**Instrução:** Selecione no menu abaixo o Killer que o seu time quer **JOGAR** no set.'
    : '**Instrução:** Selecione no menu abaixo o Killer que você deseja **BANIR** (ele ficará indisponível).';

  return new EmbedBuilder()
    .setTitle(titleAction)
    .setColor(embedColor as any)
    .setDescription(
      [
        `**Vez de:** ${timeName}`,
        `**Killers Restantes:** ${itensRestantes.length}`,
        '',
        '**Killers disponiveis:**',
        preview,
        itensRestantes.length > 12 ? `\n...e mais ${itensRestantes.length - 12}` : '',
        '',
        instructionText,
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createBanEmbed(
  action: string,
  timeName: string,
  itemBanido: string,
  proximoTimeName: string,
  hasMore: boolean,
): EmbedBuilder {
  const nextStep = hasMore
    ? [
      `**Vez de:** ${proximoTimeName}`,
      '',
      'Aguardando proxima escolha no menu.',
    ]
    : ['Banimento concluido. Preparando os sets...'];

  const title = action === 'pick' ? 'KILLER ESCOLHIDO' : 'KILLER BANIDO';
  const actVerb = action === 'pick' ? 'escolheu' : 'baniu';
  const embedColor = action === 'pick' ? COLORS.success : COLORS.accent;

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(embedColor as any)
    .setDescription(
      [
        `**${timeName} ${actVerb}:** ${itemBanido}`,
        '',
        ...nextStep,
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createSetsReadyEmbed(
  assignments: SetAssignment[],
  timeAName: string,
  timeBName: string,
): EmbedBuilder {
  const sets = assignments.flatMap(assignment => [
    `**SET ${assignment.numero}**`,
    `Mapa: ${assignment.mapa}`,
    `Killer: ${assignment.killer}`,
    `Quem começa de killer: ${assignment.killerTime === 'A' ? timeAName : timeBName}`,
    '',
  ]);

  return new EmbedBuilder()
    .setTitle('SETS DEFINIDOS')
    .setColor(COLORS.gold as any)
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

export function createResultadoEmbed(
  confronto: ConfrontoData,
  vencedorName: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`RESULTADO — CONFRONTO #${confronto.id}`)
    .setColor(COLORS.gold as any)
    .setDescription(
      [
        `**VENCEDOR:** ${vencedorName}`,
        '',
        `**Pool ${confronto.pool} — ${confronto.formato}**`,
        `**Placar Final:** ${confronto.timeAVitorias}-${confronto.timeBVitorias}`,
        '',
        '---',
        'Aguardando encerramento...',
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createEncerramentoEmbed(
  confrontoId: number,
  motivo?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`CONFRONTO #${confrontoId} ENCERRADO`)
    .setColor(COLORS.neutral as any)
    .setDescription(
      motivo
        ? `**Motivo:** ${motivo}`
        : 'Confronto encerrado pela organizacao.',
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('ERRO')
    .setColor(COLORS.error as any)
    .setDescription(message)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createSuccessEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('SUCESSO')
    .setColor(COLORS.success as any)
    .setDescription(message)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createListarConfrontosEmbed(
  confrontos: ConfrontoData[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('CONFRONTOS ATIVOS')
    .setColor(COLORS.primary as any)
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

export function createRankingEmbed(
  ranking: Array<{ nome: string; vitorias: number; derrotas: number }>,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('RANKING — QUEENS TRIALS')
    .setColor(COLORS.gold as any)
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

export function createPerfilEmbed(
  nome: string,
  confrontos: number,
  vitorias: number,
  derrotas: number,
): EmbedBuilder {
  const winRate = confrontos > 0
    ? ((vitorias / confrontos) * 100).toFixed(1)
    : '0.0';

  return new EmbedBuilder()
    .setTitle(`PERFIL — ${nome}`)
    .setColor(COLORS.accent as any)
    .setDescription(
      [
        `**Confrontos:** ${confrontos}`,
        `**Vitorias:** ${vitorias}`,
        `**Derrotas:** ${derrotas}`,
        `**Win Rate:** ${winRate}%`,
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}
