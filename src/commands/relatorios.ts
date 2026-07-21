import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import prisma from '../database/client';
import { COLORS } from '../config';

const DTA_LOGO = 'https://pxdrop.online/raw/d9fv0fmhv1ts73baugmg?file=queens-trials-logo.png';

export const data = new SlashCommandBuilder()
  .setName('relatorios')
  .setDescription('Mostra relatorios operacionais do torneio')
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand
      .setName('resumo')
      .setDescription('Mostra resumo geral do servidor'),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('confrontos')
      .setDescription('Mostra ultimos confrontos registrados'),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('pools')
      .setDescription('Mostra status das pools configuradas'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
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

async function handleResumo(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const [totalConfrontos, confrontosAtivos, confrontosEncerrados, jogadores, poolsAtivas] = await Promise.all([
    prisma.confronto.count({ where: { guildId } }),
    prisma.confronto.count({ where: { guildId, status: { not: 'encerrado' } } }),
    prisma.confronto.count({ where: { guildId, status: 'encerrado' } }),
    prisma.jogador.count({ where: { guildId } }),
    prisma.pool.count({ where: { guildId, ativa: true } }),
  ]);

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

async function handleConfrontos(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const confrontos = await prisma.confronto.findMany({
    where: { guildId },
    orderBy: { criadoEm: 'desc' },
    take: 10,
  });

  const embed = baseReportEmbed('RELATORIO — CONFRONTOS');

  if (confrontos.length === 0) {
    embed.setDescription('Nenhum confronto registrado neste servidor.');
    await interaction.reply({ embeds: [embed], flags: 64 });
    return;
  }

  embed.setDescription(
    confrontos.map(confronto => [
      `**#${confronto.id}** — ${confronto.formato}`,
      `Status: ${confronto.status}`,
      `Placar: ${confronto.timeAVitorias}-${confronto.timeBVitorias}`,
      `Criado: <t:${Math.floor(confronto.criadoEm.getTime() / 1000)}:R>`,
    ].join('\n')).join('\n\n'),
  );

  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function handlePools(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const pools = await prisma.pool.findMany({
    where: { guildId },
    include: {
      mapas: true,
      killers: true,
      _count: { select: { confrontos: true } },
    },
    orderBy: { id: 'asc' },
  });

  const embed = baseReportEmbed('RELATORIO — POOLS');

  if (pools.length === 0) {
    embed.setDescription('Nenhuma pool configurada neste servidor.');
    await interaction.reply({ embeds: [embed], flags: 64 });
    return;
  }

  embed.setDescription(
    pools.map(pool => [
      `**${pool.nome}** (ID: ${pool.id}) — ${pool.ativa ? 'Ativa' : 'Inativa'}`,
      `Formato: ${pool.formato}`,
      `Mapas: ${pool.mapas.length}`,
      `Killers: ${pool.killers.length}`,
      `Confrontos: ${pool._count.confrontos}`,
    ].join('\n')).join('\n\n'),
  );

  await interaction.reply({ embeds: [embed], flags: 64 });
}

function baseReportEmbed(title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.accent as any)
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();
}
