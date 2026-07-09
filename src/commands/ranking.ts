import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import prisma from '../database/client';
import { createRankingEmbed, createErrorEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('Mostra o ranking dos times')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const confrontos = await prisma.confronto.findMany({
    where: {
      guildId: interaction.guildId!,
      status: 'encerrado',
    },
  });

  const timesMap = new Map<string, { nome: string; vitorias: number; derrotas: number }>();

  for (const confronto of confrontos) {
    if (!confronto.vencedor) continue;

    const timeARole = await interaction.guild!.roles.fetch(confronto.timeARoleId);
    const timeBRole = await interaction.guild!.roles.fetch(confronto.timeBRoleId);

    if (!timeARole || !timeBRole) continue;

    if (!timesMap.has(confronto.timeARoleId)) {
      timesMap.set(confronto.timeARoleId, {
        nome: timeARole.name,
        vitorias: 0,
        derrotas: 0,
      });
    }

    if (!timesMap.has(confronto.timeBRoleId)) {
      timesMap.set(confronto.timeBRoleId, {
        nome: timeBRole.name,
        vitorias: 0,
        derrotas: 0,
      });
    }

    const timeAData = timesMap.get(confronto.timeARoleId)!;
    const timeBData = timesMap.get(confronto.timeBRoleId)!;

    if (confronto.vencedor === 'A') {
      timeAData.vitorias++;
      timeBData.derrotas++;
    } else {
      timeBData.vitorias++;
      timeAData.derrotas++;
    }
  }

  const ranking = Array.from(timesMap.values()).sort((a, b) => {
    return b.vitorias - a.vitorias;
  });

  const embed = createRankingEmbed(ranking);

  await interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}
