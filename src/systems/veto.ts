import {
  ActionRowBuilder,
  Guild,
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import prisma from '../database/client';
import { PoolConfig, VetoVez } from '../types/index';
import {
  createBanEmbed,
  createErrorEmbed,
  createSetsReadyEmbed,
  createVetoEmbed,
} from '../utils/embeds';
import { createSetAssignments } from './veto-rules';

export async function startVeto(
  guild: Guild,
  confrontoId: number,
  poolConfig: PoolConfig,
  primeiroKiller: VetoVez,
  canalTexto: TextChannel,
): Promise<void> {
  await prisma.vetoState.create({
    data: {
      confrontoId,
      tipo: 'killer',
      set: 1,
      vezDe: primeiroKiller,
      mapasRestantes: JSON.stringify(poolConfig.mapas),
      killersRestantes: JSON.stringify(poolConfig.killers),
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

  const mapas = JSON.parse(vetoState.mapasRestantes) as string[];
  const killers = JSON.parse(vetoState.killersRestantes) as string[];
  if (killers.length <= mapas.length) {
    await finalizeVeto(guild, confrontoId, canalTexto);
    return;
  }

  const timeARole = await guild.roles.fetch(confronto.timeARoleId);
  const timeBRole = await guild.roles.fetch(confronto.timeBRoleId);
  if (!timeARole || !timeBRole) return;

  const vezRole = vetoState.vezDe === 'A' ? timeARole : timeBRole;
  const embed = createVetoEmbed(mapas.length, killers, vezRole.name);
  const banSelect = new StringSelectMenuBuilder()
    .setCustomId(`killer-ban:${confrontoId}`)
    .setPlaceholder('Escolha um killer para banir')
    .addOptions(
      killers.map((killer, index) => ({
        label: killer.slice(0, 100),
        value: killer,
        description: `${index + 1} de ${killers.length}`,
      })),
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(banSelect);
  const message = await canalTexto.send({
    content: `<@&${vezRole.id}>`,
    embeds: [embed],
    components: [row],
  });

  await prisma.vetoState.update({
    where: { confrontoId },
    data: { messageId: message.id },
  });
}

export async function handleBanSelection(
  interaction: StringSelectMenuInteraction,
  confrontoId: number,
): Promise<void> {
  const vetoState = await prisma.vetoState.findUnique({
    where: { confrontoId },
  });
  if (!vetoState || vetoState.tipo !== 'killer') {
    await interaction.reply({
      embeds: [createErrorEmbed('Estado de veto nao encontrado. Use a mensagem mais recente.')],
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
  if (!member?.roles.cache.has(vezRoleId)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Nao e a vez do seu time.')],
      flags: 64,
    });
    return;
  }

  const killers = JSON.parse(vetoState.killersRestantes) as string[];
  const mapas = JSON.parse(vetoState.mapasRestantes) as string[];
  const killerBanido = interaction.values[0];
  const killerIndex = killers.indexOf(killerBanido);
  if (killerIndex < 0 || killers.length <= mapas.length) {
    await interaction.reply({
      embeds: [createErrorEmbed('Killer indisponivel. Use a mensagem mais recente.')],
      flags: 64,
    });
    return;
  }

  await interaction.deferUpdate();

  const killersRestantes = killers.filter((_, index) => index !== killerIndex);
  const proximaVez: VetoVez = vetoState.vezDe === 'A' ? 'B' : 'A';
  const proximoTimeName = proximaVez === 'A' ? timeARole.name : timeBRole.name;
  const bansRestantes = killersRestantes.length - mapas.length;

  await interaction.editReply({
    embeds: [createBanEmbed(
      vetoState.vezDe === 'A' ? timeARole.name : timeBRole.name,
      killerBanido,
      proximoTimeName,
      bansRestantes,
    )],
    components: [],
  });

  await prisma.vetoState.update({
    where: { confrontoId },
    data: {
      killersRestantes: JSON.stringify(killersRestantes),
      vezDe: proximaVez,
    },
  });

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
  const confronto = await prisma.confronto.findUnique({
    where: { id: confrontoId },
  });
  if (!vetoState || !confronto?.primeiroKiller) return;

  const timeARole = await guild.roles.fetch(confronto.timeARoleId);
  const timeBRole = await guild.roles.fetch(confronto.timeBRoleId);
  if (!timeARole || !timeBRole) return;

  const mapas = JSON.parse(vetoState.mapasRestantes) as string[];
  const killers = JSON.parse(vetoState.killersRestantes) as string[];
  const assignments = createSetAssignments(
    mapas,
    killers,
    confronto.primeiroKiller as VetoVez,
  );

  await prisma.$transaction([
    prisma.set.deleteMany({ where: { confrontoId } }),
    prisma.set.createMany({
      data: assignments.map(assignment => ({
        confrontoId,
        numero: assignment.numero,
        mapaUsado: assignment.mapa,
        killerUsado: assignment.killer,
        killerTime: assignment.killerTime,
      })),
    }),
    prisma.confronto.update({
      where: { id: confrontoId },
      data: { status: 'em_andamento', currentSet: 1 },
    }),
    prisma.vetoState.delete({ where: { confrontoId } }),
  ]);

  await canalTexto.send({
    embeds: [createSetsReadyEmbed(assignments, timeARole.name, timeBRole.name)],
  });
}
