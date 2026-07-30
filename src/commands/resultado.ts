import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { PoolFormato } from '../config';
import { createResultadoEmbed, createErrorEmbed } from '../utils/embeds';
import { ConfrontoData, VencedorTime } from '../types/index';
import {
  confrontationService,
  ConfrontationServiceError,
} from '../services/confrontation-service';

export const data = new SlashCommandBuilder()
  .setName('resultado')
  .setDescription('Registra o vencedor do confronto')
  .setDMPermission(false)
  .addIntegerOption(option =>
    option
      .setName('confronto-id')
      .setDescription('ID do confronto')
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName('vencedor')
      .setDescription('Time vencedor do confronto')
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const confrontoId = interaction.options.getInteger('confronto-id', true);
  const vencedor = interaction.options.getRole('vencedor', true);

  let result;
  try {
    result = await confrontationService.recordResult(
      confrontoId,
      vencedor.id,
      interaction.guildId!,
    );
  } catch (error: unknown) {
    if (!(error instanceof ConfrontationServiceError)) throw error;
    await interaction.reply({ embeds: [createErrorEmbed(error.message)], flags: 64 });
    return;
  }

  const confronto = result.previous;
  const vencedorTime: VencedorTime = result.winner;

  const confrontoData: ConfrontoData = {
    ...confronto,
    vencedor: vencedorTime,
    formato: confronto.formato as PoolFormato,
    primeiroKiller: confronto.primeiroKiller as 'A' | 'B' | null,
  };

  const embed = createResultadoEmbed(confrontoData, vencedor.name);

  if (confronto.channelId) {
    const canal = await interaction.guild!.channels.fetch(confronto.channelId);
    if (canal?.isTextBased()) {
      await canal.send({ embeds: [embed] });
    }
  }

  await interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}
