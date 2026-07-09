import {
  Guild,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  GuildMember,
} from 'discord.js';
import prisma from '../database/client';
import { PoolConfig, VetoVez } from '../types/index';
import { createVetoEmbed, createBanEmbed, createErrorEmbed } from '../utils/embeds';
import { COLORS } from '../config';

const DTA_LOGO = 'https://ncfnquvxpleeosuuunob.supabase.co/storage/v1/object/public/dbdmaps//logo-01.webp';

export async function startVeto(
  guild: Guild,
  confrontoId: number,
  poolConfig: PoolConfig,
  set: number,
  canalTexto: TextChannel,
): Promise<void> {
  const mapas = [...poolConfig.mapas];
  const killers = [...poolConfig.killers];

  await prisma.vetoState.create({
    data: {
      confrontoId,
      tipo: 'mapa',
      set,
      vezDe: 'A',
      mapasRestantes: JSON.stringify(mapas),
      killersRestantes: JSON.stringify(killers),
    },
  });

  await sendVetoStep(guild, confrontoId, canalTexto);
}

async function sendVetoStep(
  guild: Guild,
  confrontoId: number,
  canalTexto: TextChannel,
): Promise<void> {
  const vetoState = await prisma.vetoState.findUnique({
    where: { confrontoId },
  });

  if (!vetoState) return;

  const confronto = await prisma.confronto.findUnique({
    where: { id: confrontoId },
  });

  if (!confronto) return;

  const timeARole = await guild.roles.fetch(confronto.timeARoleId);
  const timeBRole = await guild.roles.fetch(confronto.timeBRoleId);

  if (!timeARole || !timeBRole) return;

  const vezRole = vetoState.vezDe === 'A' ? timeARole : timeBRole;
  const itensRestantes = vetoState.tipo === 'mapa'
    ? JSON.parse(vetoState.mapasRestantes) as string[]
    : JSON.parse(vetoState.killersRestantes) as string[];

  if (itensRestantes.length <= 1) {
    await finalizeVeto(guild, confrontoId, canalTexto);
    return;
  }

  const itemAtual = itensRestantes[0];

  const embed = createVetoEmbed(
    vetoState.tipo as 'mapa' | 'killer',
    vetoState.set,
    vezRole.name,
    itemAtual,
    vezRole.name,
  );

  const banButton = new ButtonBuilder()
    .setCustomId(`ban:${confrontoId}:${vetoState.tipo}`)
    .setLabel('BANIR')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(banButton);

  const msg = await canalTexto.send({
    content: `<@&${vezRole.id}>`,
    embeds: [embed],
    components: [row],
  });

  await prisma.vetoState.update({
    where: { confrontoId },
    data: { messageId: msg.id },
  });
}

export async function handleBanButton(
  interaction: ButtonInteraction,
  confrontoId: number,
  tipo: string,
): Promise<void> {
  const vetoState = await prisma.vetoState.findUnique({
    where: { confrontoId },
  });

  if (!vetoState) {
    await interaction.reply({
      embeds: [createErrorEmbed('Estado de veto nao encontrado.')],
      flags: 64,
    });
    return;
  }

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

  const timeARole = await interaction.guild!.roles.fetch(confronto.timeARoleId);
  const timeBRole = await interaction.guild!.roles.fetch(confronto.timeBRoleId);

  if (!timeARole || !timeBRole) {
    await interaction.reply({
      embeds: [createErrorEmbed('Time nao encontrado.')],
      flags: 64,
    });
    return;
  }

  const vezRoleId = vetoState.vezDe === 'A' ? timeARole.id : timeBRole.id;

  const member = interaction.member as GuildMember | null;
  if (!member || !member.roles.cache.has(vezRoleId)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Nao e a vez do seu time.')],
      flags: 64,
    });
    return;
  }

  await interaction.deferUpdate();

  const itensRestantes = vetoState.tipo === 'mapa'
    ? JSON.parse(vetoState.mapasRestantes) as string[]
    : JSON.parse(vetoState.killersRestantes) as string[];

  const itemBanido = itensRestantes.shift()!;

  const proximoTimeName = vetoState.vezDe === 'A' ? timeBRole.name : timeARole.name;
  const proximoItem = itensRestantes[0] || 'Definido';

  const embed = createBanEmbed(
    vetoState.tipo as 'mapa' | 'killer',
    vetoState.set,
    vetoState.vezDe === 'A' ? timeARole.name : timeBRole.name,
    itemBanido,
    proximoTimeName,
    proximoItem,
  );

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });

  const proximaVez: VetoVez = vetoState.vezDe === 'A' ? 'B' : 'A';

  if (vetoState.tipo === 'mapa') {
    await prisma.vetoState.update({
      where: { confrontoId },
      data: {
        mapasRestantes: JSON.stringify(itensRestantes),
        vezDe: proximaVez,
      },
    });
  } else {
    await prisma.vetoState.update({
      where: { confrontoId },
      data: {
        killersRestantes: JSON.stringify(itensRestantes),
        vezDe: proximaVez,
      },
    });
  }

  await sendVetoStep(interaction.guild!, confrontoId, interaction.channel as TextChannel);
}

async function finalizeVeto(
  guild: Guild,
  confrontoId: number,
  canalTexto: TextChannel,
): Promise<void> {
  const vetoState = await prisma.vetoState.findUnique({
    where: { confrontoId },
  });

  if (!vetoState) return;

  const itensRestantes = vetoState.tipo === 'mapa'
    ? JSON.parse(vetoState.mapasRestantes) as string[]
    : JSON.parse(vetoState.killersRestantes) as string[];

  const itemEscolhido = itensRestantes[0];

  if (vetoState.tipo === 'mapa') {
    await prisma.vetoState.update({
      where: { confrontoId },
      data: {
        mapaEscolhido: itemEscolhido,
        tipo: 'killer',
        vezDe: 'A',
      },
    });

    await canalTexto.send({
      embeds: [
        {
          title: `MAPA DEFINIDO — SET ${vetoState.set}`,
          color: parseInt(COLORS.success.replace('#', ''), 16),
          description: `**Mapa:** ${itemEscolhido}\n\nIniciando veto de killers...`,
          thumbnail: { url: DTA_LOGO },
          footer: { text: 'Dark Trials Arena' },
        },
      ],
    });

    await sendVetoStep(guild, confrontoId, canalTexto);
  } else {
    await prisma.vetoState.update({
      where: { confrontoId },
      data: {
        killerEscolhido: itemEscolhido,
      },
    });

    await prisma.set.create({
      data: {
        confrontoId,
        numero: vetoState.set,
        mapaUsado: vetoState.mapaEscolhido,
        killerUsado: itemEscolhido,
      },
    });

    await prisma.confronto.update({
      where: { id: confrontoId },
      data: {
        status: 'em_andamento',
        currentSet: vetoState.set,
      },
    });

    await canalTexto.send({
      embeds: [
        {
          title: `SET ${vetoState.set} PRONTO`,
          color: parseInt(COLORS.gold.replace('#', ''), 16),
          description: [
            `**Mapa:** ${vetoState.mapaEscolhido}`,
            `**Killer:** ${itemEscolhido}`,
            '',
            'Os times podem comecar a jogar!',
          ].join('\n'),
          thumbnail: { url: DTA_LOGO },
          footer: { text: 'Dark Trials Arena' },
        },
      ],
    });

    await prisma.vetoState.delete({
      where: { confrontoId },
    });
  }
}
