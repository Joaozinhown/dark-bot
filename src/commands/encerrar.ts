import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import prisma from '../database/client';
import { deleteConfrontoChannels } from '../utils/channels';
import { createEncerramentoEmbed, createErrorEmbed, createSuccessEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('encerrar')
  .setDescription('Encerra um confronto e limpa canais')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
  )
  .addBooleanOption(option =>
    option
      .setName('apagar-chat')
      .setDescription('Apagar canal de texto (padrao: false)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const confrontoId = interaction.options.getInteger('confronto-id', true);
  const motivo = interaction.options.getString('motivo');
  const apagarChat = interaction.options.getBoolean('apagar-chat') ?? false;

  const confronto = await prisma.confronto.findUnique({
    where: { id: confrontoId },
  });

  if (!confronto) {
    await interaction.reply({
      embeds: [createErrorEmbed('Confronto nao encontrado.')],
      flags: 64,
    });
    return;
  }

  if (confronto.status === 'encerrado') {
    await interaction.reply({
      embeds: [createErrorEmbed('Este confronto ja foi encerrado.')],
      flags: 64,
    });
    return;
  }

  await interaction.deferReply();

  await prisma.confronto.update({
    where: { id: confrontoId },
    data: {
      status: 'encerrado',
      encerradoEm: new Date(),
      motivoEncerramento: motivo,
    },
  });

  await deleteConfrontoChannels(
    interaction.guild!,
    confronto.vozTimeAId,
    confronto.vozTimeBId,
    apagarChat ? confronto.channelId : null,
  );

  const embed = createEncerramentoEmbed(confrontoId, motivo ?? undefined);

  await interaction.editReply({
    embeds: [embed],
  });
}
