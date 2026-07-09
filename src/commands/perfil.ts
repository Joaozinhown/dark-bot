import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import prisma from '../database/client';
import { createPerfilEmbed, createErrorEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Mostra seu perfil e estatisticas')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  let jogador = await prisma.jogador.findUnique({
    where: {
      id_guildId: {
        id: userId,
        guildId,
      },
    },
  });

  if (!jogador) {
    jogador = await prisma.jogador.create({
      data: {
        id: userId,
        guildId,
        nome: interaction.user.displayName,
      },
    });
  }

  const embed = createPerfilEmbed(
    interaction.user.displayName,
    jogador.confrontos,
    jogador.vitorias,
    jogador.derrotas,
  );

  await interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}
