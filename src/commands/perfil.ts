import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { createPerfilEmbed, createErrorEmbed } from '../utils/embeds';
import { playerService } from '../services/player-service';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Mostra seu perfil e estatisticas')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  const jogador = await playerService.getOrCreate(
    userId,
    guildId,
    interaction.user.displayName,
  );

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
