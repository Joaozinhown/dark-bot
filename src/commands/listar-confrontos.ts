import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import prisma from '../database/client';
import { createListarConfrontosEmbed } from '../utils/embeds';
import { ConfrontoData } from '../types/index';
import { PoolFormato } from '../config';

export const data = new SlashCommandBuilder()
  .setName('listar-confrontos')
  .setDescription('Lista confrontos ativos e recentes')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const confrontos = await prisma.confronto.findMany({
    where: {
      guildId: interaction.guildId!,
      status: {
        not: 'encerrado',
      },
    },
    orderBy: {
      criadoEm: 'desc',
    },
    take: 10,
  });

  const confrontosData: ConfrontoData[] = confrontos.map(c => ({
    ...c,
    formato: c.formato as PoolFormato,
    vencedor: c.vencedor as 'A' | 'B' | null,
  }));

  const embed = createListarConfrontosEmbed(confrontosData);

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
