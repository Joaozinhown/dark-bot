import { EmbedBuilder, Colors } from 'discord.js';
import { COLORS } from '../config';
import { ConfrontoData, PoolFormato } from '../types/index';

const DTA_LOGO = 'https://ncfnquvxpleeosuuunob.supabase.co/storage/v1/object/public/dbdmaps//logo-01.webp';

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
        '',
        '---',
        '**INICIANDO VETO DE MAPAS — SET 1**',
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createVetoEmbed(
  tipo: 'mapa' | 'killer',
  set: number,
  vezDe: string,
  itensRestantes: string[],
  timeName: string,
): EmbedBuilder {
  const title = tipo === 'mapa'
    ? `VETO DE MAPAS — SET ${set}`
    : `VETO DE KILLERS — SET ${set}`;

  const itemLabel = tipo === 'mapa' ? 'Mapas' : 'Killers';
  const preview = itensRestantes
    .slice(0, 12)
    .map((item, index) => `**${index + 1}.** ${item}`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.accent as any)
    .setDescription(
      [
        `**Vez de:** ${timeName}`,
        `**Restantes:** ${itensRestantes.length}`,
        '',
        `**${itemLabel} disponiveis:**`,
        preview,
        itensRestantes.length > 12 ? `\n...e mais ${itensRestantes.length - 12}` : '',
        '',
        'Use o menu abaixo para escolher o banimento.',
      ].join('\n'),
    )
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}

export function createBanEmbed(
  tipo: 'mapa' | 'killer',
  set: number,
  timeName: string,
  itemBanido: string,
  proximoTimeName: string,
  proximoItem: string,
): EmbedBuilder {
  const title = tipo === 'mapa'
    ? `MAPA BANIDO — SET ${set}`
    : `KILLER BANIDO — SET ${set}`;

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.gold as any)
    .setDescription(
      [
        `**${timeName} baniu:** ${itemBanido}`,
        '',
        `**Vez de:** ${proximoTimeName}`,
        `**Proximo restante:** ${proximoItem}`,
        '',
        'Aguardando proxima escolha no menu.',
      ].join('\n'),
    )
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
