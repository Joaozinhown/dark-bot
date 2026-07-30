import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { createRankingEmbed } from '../utils/embeds';
import { reportService } from '../services/report-service';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('Mostra o ranking dos times')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const ranking = await reportService.getRanking(
    interaction.guildId!,
    async roleId => (await interaction.guild!.roles.fetch(roleId))?.name ?? null,
  );

  const embed = createRankingEmbed(ranking);

  await interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}
