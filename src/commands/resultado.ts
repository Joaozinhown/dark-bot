import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import prisma from '../database/client';
import { getVitoriasNecessarias, PoolFormato } from '../config';
import { createResultadoEmbed, createErrorEmbed } from '../utils/embeds';
import { ConfrontoData, VencedorTime } from '../types/index';

export const data = new SlashCommandBuilder()
  .setName('resultado')
  .setDescription('Registra o vencedor do confronto')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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

  if (vencedor.id !== confronto.timeARoleId && vencedor.id !== confronto.timeBRoleId) {
    await interaction.reply({
      embeds: [createErrorEmbed('O time vencedor deve ser um dos participantes.')],
      flags: 64,
    });
    return;
  }

  const vencedorTime: VencedorTime = vencedor.id === confronto.timeARoleId ? 'A' : 'B';

  await prisma.confronto.update({
    where: { id: confrontoId },
    data: {
      vencedor: vencedorTime,
      timeAVitorias: vencedorTime === 'A' ? confronto.timeAVitorias + 1 : confronto.timeAVitorias,
      timeBVitorias: vencedorTime === 'B' ? confronto.timeBVitorias + 1 : confronto.timeBVitorias,
      status: 'resultado',
    },
  });

  const confrontoData: ConfrontoData = {
    ...confronto,
    vencedor: vencedorTime,
    formato: confronto.formato as PoolFormato,
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
