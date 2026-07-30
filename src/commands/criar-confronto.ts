import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import { PoolFormato } from '../config';
import { createConfrontoEmbed, createErrorEmbed } from '../utils/embeds';
import { startVeto } from '../systems/veto';
import { ConfrontoData } from '../types/index';
import {
  confrontationService,
  ConfrontationServiceError,
} from '../services/confrontation-service';

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

  let created;
  try {
    created = await confrontationService.create(
      {
        guildId: interaction.guildId!,
        poolId,
        timeARoleId: timeA.id,
        timeBRoleId: timeB.id,
        channelId: textChannel.id,
      },
      () => interaction.deferReply(),
    );
  } catch (error: unknown) {
    if (!(error instanceof ConfrontationServiceError)) throw error;
    const message = error.code === 'POOL_NOT_FOUND'
      ? 'Pool nao encontrada ou inativa. Use `/gerenciar-pool listar` para ver pools disponiveis.'
      : error.message;
    await interaction.reply({ embeds: [createErrorEmbed(message)], flags: 64 });
    return;
  }

  const { poolConfig, ...confronto } = created;
  const primeiroKiller = confronto.primeiroKiller!;

  const confrontoData: ConfrontoData = {
    ...confronto,
    pool: poolId,
    channelId: textChannel.id,
    formato: confronto.formato as PoolFormato,
    vencedor: confronto.vencedor as 'A' | 'B' | null,
    primeiroKiller: confronto.primeiroKiller as 'A' | 'B' | null,
  };

  const embed = createConfrontoEmbed(confrontoData, timeA.name, timeB.name);

  // Coin toss animation
  await interaction.editReply({ content: '🪙 **Lançando a moeda...**' });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await interaction.editReply({ content: '🪙 **A moeda está no ar...**' });
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const winnerName = primeiroKiller === 'A' ? timeA.name : timeB.name;
  await interaction.editReply({ 
    content: `🪙 Cara ou Coroa finalizado! O time **${winnerName}** venceu e começará de Killer!`,
    embeds: [embed] 
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));

  await startVeto(interaction.guild!, confronto.id, poolConfig, primeiroKiller, textChannel);
}
