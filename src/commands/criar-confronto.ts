import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import prisma from '../database/client';
import { getPoolById, PoolFormato } from '../config';
import { createTeamVoiceChannel, createConfrontoTextChannel } from '../utils/channels';
import { createConfrontoEmbed, createErrorEmbed } from '../utils/embeds';
import { startVeto } from '../systems/veto';
import { ConfrontoData } from '../types/index';

export const data = new SlashCommandBuilder()
  .setName('criar-confronto')
  .setDescription('Cria um confronto entre dois times')
  .setDMPermission(false)
  .addIntegerOption(option =>
    option
      .setName('pool-id')
      .setDescription('ID da pool (use /gerenciar-pool listar para ver IDs)')
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName('time-a')
      .setDescription('Cargo do Time A')
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName('time-b')
      .setDescription('Cargo do Time B')
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);
  const timeA = interaction.options.getRole('time-a', true);
  const timeB = interaction.options.getRole('time-b', true);

  const poolConfig = await getPoolById(poolId, interaction.guildId!);

  if (!poolConfig) {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada ou inativa. Use `/gerenciar-pool listar` para ver pools disponiveis.')],
      flags: 64,
    });
    return;
  }

  if (poolConfig.mapas.length < 2) {
    await interaction.reply({
      embeds: [createErrorEmbed('A pool precisa ter pelo menos 2 mapas para o sistema de veto funcionar.')],
      flags: 64,
    });
    return;
  }

  if (poolConfig.killers.length < 2) {
    await interaction.reply({
      embeds: [createErrorEmbed('A pool precisa ter pelo menos 2 killers para o sistema de veto funcionar.')],
      flags: 64,
    });
    return;
  }

  if (timeA.id === timeB.id) {
    await interaction.reply({
      embeds: [createErrorEmbed('Os times devem ser diferentes.')],
      flags: 64,
    });
    return;
  }

  await interaction.deferReply();

  const confronto = await prisma.confronto.create({
    data: {
      guildId: interaction.guildId!,
      poolId,
      formato: poolConfig.formato,
      timeARoleId: timeA.id,
      timeBRoleId: timeB.id,
      status: 'veto',
    },
  });

  const vozTimeAId = await createTeamVoiceChannel(
    interaction.guild!,
    timeA.name,
    timeA.id,
    confronto.id,
  );

  const vozTimeBId = await createTeamVoiceChannel(
    interaction.guild!,
    timeB.name,
    timeB.id,
    confronto.id,
  );

  const channelId = await createConfrontoTextChannel(
    interaction.guild!,
    timeA.name,
    timeB.name,
    timeA.id,
    timeB.id,
    null,
    confronto.id,
  );

  await prisma.confronto.update({
    where: { id: confronto.id },
    data: {
      vozTimeAId,
      vozTimeBId,
      channelId,
    },
  });

  const canalTexto = await interaction.guild!.channels.fetch(channelId);

  if (!canalTexto?.isTextBased()) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Erro ao criar canal de texto.')],
    });
    return;
  }

  const textChannel = canalTexto as TextChannel;

  const confrontoData: ConfrontoData = {
    ...confronto,
    pool: poolId,
    vozTimeAId,
    vozTimeBId,
    channelId,
    formato: confronto.formato as PoolFormato,
    vencedor: confronto.vencedor as 'A' | 'B' | null,
  };

  const embed = createConfrontoEmbed(confrontoData, timeA.name, timeB.name);

  await textChannel.send({ embeds: [embed] });

  await interaction.editReply({ embeds: [embed] });

  await startVeto(interaction.guild!, confronto.id, poolConfig, 1, textChannel);
}
