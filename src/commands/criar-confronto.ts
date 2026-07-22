import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import prisma from '../database/client';
import { getPoolById, getSetsMaximos, PoolFormato } from '../config';
import { createTeamVoiceChannel } from '../utils/channels';
import { createConfrontoEmbed, createErrorEmbed } from '../utils/embeds';
import { startVeto } from '../systems/veto';
import { ConfrontoData } from '../types/index';
import { drawStartingTeam } from '../systems/veto-rules';

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

  if (!(interaction.channel instanceof TextChannel)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Use este comando em um canal de texto do confronto.')],
      flags: 64,
    });
    return;
  }

  const textChannel = interaction.channel;

  const poolConfig = await getPoolById(poolId, interaction.guildId!);

  if (!poolConfig) {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada ou inativa. Use `/gerenciar-pool listar` para ver pools disponiveis.')],
      flags: 64,
    });
    return;
  }

  const setsMaximos = getSetsMaximos(poolConfig.formato);

  if (poolConfig.mapas.length !== setsMaximos) {
    await interaction.reply({
      embeds: [createErrorEmbed(`A pool ${poolConfig.formato} precisa ter exatamente ${setsMaximos} mapas presetados.`)],
      flags: 64,
    });
    return;
  }

  if (poolConfig.killers.length <= setsMaximos) {
    await interaction.reply({
      embeds: [createErrorEmbed(`A pool precisa ter mais de ${setsMaximos} killers para permitir bans.`)],
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

  const primeiroKiller = drawStartingTeam();

  const confronto = await prisma.confronto.create({
    data: {
      guildId: interaction.guildId!,
      poolId,
      formato: poolConfig.formato,
      timeARoleId: timeA.id,
      timeBRoleId: timeB.id,
      primeiroKiller,
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

  await prisma.confronto.update({
    where: { id: confronto.id },
    data: {
      vozTimeAId,
      vozTimeBId,
      channelId: textChannel.id,
    },
  });

  const confrontoData: ConfrontoData = {
    ...confronto,
    pool: poolId,
    vozTimeAId,
    vozTimeBId,
    channelId: textChannel.id,
    formato: confronto.formato as PoolFormato,
    vencedor: confronto.vencedor as 'A' | 'B' | null,
    primeiroKiller: confronto.primeiroKiller as 'A' | 'B' | null,
  };

  const embed = createConfrontoEmbed(confrontoData, timeA.name, timeB.name);

  await interaction.editReply({ embeds: [embed] });

  await startVeto(interaction.guild!, confronto.id, poolConfig, primeiroKiller, textChannel);
}
