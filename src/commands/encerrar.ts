import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { deleteConfrontoVoiceChannels } from '../utils/channels';
import { createEncerramentoEmbed, createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import {
  confrontationService,
  ConfrontationServiceError,
} from '../services/confrontation-service';

export const data = new SlashCommandBuilder()
  .setName('encerrar')
  .setDescription('Encerra um confronto e limpa canais')
  .setDMPermission(false)
  .addIntegerOption(option =>
    option
      .setName('confronto-id')
      .setDescription('ID do confronto')
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName('motivo')
      .setDescription('Motivo do encerramento'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const confrontoId = interaction.options.getInteger('confronto-id', true);
  const motivo = interaction.options.getString('motivo');

  let confronto;
  try {
    confronto = await confrontationService.close(
      confrontoId,
      motivo,
      interaction.guildId!,
      () => interaction.deferReply(),
    );
  } catch (error: unknown) {
    if (!(error instanceof ConfrontationServiceError)) throw error;
    await interaction.reply({ embeds: [createErrorEmbed(error.message)], flags: 64 });
    return;
  }
  await deleteConfrontoVoiceChannels(
    interaction.guild!,
    confronto.vozTimeAId,
    confronto.vozTimeBId,
  );

  const embed = createEncerramentoEmbed(confrontoId, motivo ?? undefined);

  await interaction.editReply({
    embeds: [embed],
  });
}
