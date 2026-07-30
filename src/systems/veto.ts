import {
  ActionRowBuilder,
  Guild,
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import prisma from '../database/client';
import {
  VetoSelectionServiceError,
  vetoSelectionService,
} from '../services/veto-selection-service';
import { PoolConfig, PoolFormato, VetoVez } from '../types/index';
import {
  createBanEmbed,
  createErrorEmbed,
  createSetsReadyEmbed,
  createVetoEmbed,
} from '../utils/embeds';
import { guildEventBus } from '../web/realtime/event-bus';
import { createSetAssignments, getVetoAction } from './veto-rules';

const VETO_STEP_SEND_ATTEMPTS = 3;
const VETO_STEP_RETRY_DELAY_MS = 750;

async function sendVetoStepWithRetry(
  guild: Guild,
  confrontoId: number,
  channel: TextChannel,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= VETO_STEP_SEND_ATTEMPTS; attempt += 1) {
    try {
      await sendVetoStep(guild, confrontoId, channel);
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt < VETO_STEP_SEND_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, VETO_STEP_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

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
      set: 0,
      vezDe: primeiroKiller,
      mapasRestantes: JSON.stringify(poolConfig.mapas),
      killersRestantes: JSON.stringify(poolConfig.killers),
      killerEscolhido: '[]',
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

  const killers = JSON.parse(vetoState.killersRestantes) as string[];
  if (killers.length <= 1) {
    await finalizeVeto(guild, confrontoId, canalTexto);
    return;
  }

  const stepIndex = vetoState.set;
  const { action, isTiebreak } = getVetoAction(confronto.formato as PoolFormato, stepIndex);

  const timeARole = await guild.roles.fetch(confronto.timeARoleId);
  const timeBRole = await guild.roles.fetch(confronto.timeBRoleId);
  if (!timeARole || !timeBRole) return;

  const vezRole = vetoState.vezDe === 'A' ? timeARole : timeBRole;
  const embed = createVetoEmbed(action, killers, vezRole.name, isTiebreak);
  const banSelect = new StringSelectMenuBuilder()
    .setCustomId(`killer-ban:${confrontoId}`)
    .setPlaceholder(action === 'pick' ? 'Escolha um killer para jogar' : 'Escolha um killer para banir')
    .addOptions(
      killers.map((killer, index) => ({
        label: killer.slice(0, 100),
        value: killer,
        description: `${index + 1} de ${killers.length}`,
      })),
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(banSelect);
  const actionTextContent = action === 'pick' ? 'escolher o Killer' : 'banir um Killer';
  const message = await canalTexto.send({
    nonce: `v-${confrontoId}-${stepIndex}`,
    enforceNonce: true,
    content: `<@&${vezRole.id}>, chegou a vez do seu time **${actionTextContent}**!`,
    embeds: [embed],
    components: [row],
  });

  try {
    const updated = await prisma.vetoState.updateMany({
      where: { confrontoId, set: stepIndex, messageId: null },
      data: { messageId: message.id },
    });
    if (updated.count !== 1) {
      const currentState = await prisma.vetoState.findUnique({ where: { confrontoId } });
      if (currentState?.messageId !== message.id) {
        await message.delete().catch(() => undefined);
      }
    }
  } catch (error: unknown) {
    let currentState;
    try {
      currentState = await prisma.vetoState.findUnique({ where: { confrontoId } });
    } catch {
      throw error;
    }
    if (currentState?.messageId === message.id) return;
    await message.delete().catch(() => undefined);
    throw error;
  }
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

  if (
    interaction.guildId !== confronto.guildId
    || interaction.channelId !== confronto.channelId
  ) {
    await interaction.reply({
      embeds: [createErrorEmbed('Esta interacao nao pertence ao canal deste confronto.')],
      flags: 64,
    });
    return;
  }

  if (!vetoState.messageId || interaction.message.id !== vetoState.messageId) {
    await interaction.reply({
      embeds: [createErrorEmbed('Esta etapa ja expirou. Use a mensagem mais recente.')],
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

  await interaction.deferUpdate();

  const selectedKiller = interaction.values[0];
  if (!selectedKiller) {
    await interaction.followUp({
      embeds: [createErrorEmbed('Nenhum killer foi selecionado.')],
      flags: 64,
    });
    return;
  }

  let selection;
  try {
    selection = await vetoSelectionService.select({
      guildId: confronto.guildId,
      channelId: interaction.channelId,
      confrontationId: confrontoId,
      format: confronto.formato as PoolFormato,
      stepIndex: vetoState.set,
      turn: vetoState.vezDe as VetoVez,
      messageId: interaction.message.id,
      killersSerialized: vetoState.killersRestantes,
      pickedKillersSerialized: vetoState.killerEscolhido ?? '[]',
      killer: selectedKiller,
      actor: {
        userId: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.globalName ?? interaction.user.displayName,
        teamSide: vetoState.vezDe as VetoVez,
        teamRoleId: vezRoleId,
        teamRoleName: vetoState.vezDe === 'A' ? timeARole.name : timeBRole.name,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof VetoSelectionServiceError
      ? error.message
      : 'Nao foi possivel registrar esta escolha. Tente novamente pela mensagem mais recente.';
    if (!(error instanceof VetoSelectionServiceError)) {
      console.error(`[Veto] Falha ao registrar escolha no confronto ${confrontoId}:`, error);
    }
    await interaction.followUp({ embeds: [createErrorEmbed(message)], flags: 64 });
    return;
  }

  const proximoTimeName = selection.nextTurn === 'A' ? timeARole.name : timeBRole.name;
  const currentTeamName = vetoState.vezDe === 'A' ? timeARole.name : timeBRole.name;
  const verbText = selection.action === 'pick' ? 'escolheu' : 'baniu';

  let editFailure: unknown;
  try {
    await interaction.editReply({
      content: `O time **${currentTeamName}** ${verbText} o Killer **${selection.selectedKiller}**!`,
      embeds: [createBanEmbed(
        selection.action,
        currentTeamName,
        selection.selectedKiller,
        proximoTimeName,
        selection.remainingKillers.length > 1,
        selection.isTiebreak,
      )],
      components: [],
    });
  } catch (error: unknown) {
    editFailure = error;
    console.error(`[Veto] Escolha persistida, mas a mensagem ${interaction.message.id} nao foi atualizada:`, error);
  }

  guildEventBus.publish(confronto.guildId, `veto.${selection.action}`, {
    confrontationId: confrontoId,
    actorUserId: interaction.user.id,
    killer: selection.selectedKiller,
    setNumber: selection.setNumber,
  });

  try {
    await sendVetoStepWithRetry(interaction.guild!, confrontoId, interaction.channel as TextChannel);
  } catch (error: unknown) {
    console.error(`[Veto] Escolha persistida, mas a proxima etapa do confronto ${confrontoId} nao foi enviada:`, error);
    await interaction.followUp({
      embeds: [createErrorEmbed('A escolha foi registrada, mas a proxima etapa nao foi enviada apos tres tentativas. Avise a staff.')],
      flags: 64,
    });
    return;
  }

  if (editFailure) {
    await interaction.followUp({
      embeds: [createErrorEmbed('A escolha foi registrada, mas a mensagem anterior nao pôde ser atualizada. Use a nova etapa enviada no canal.')],
      flags: 64,
    });
  }
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
  const pickedKillers = vetoState.killerEscolhido ? JSON.parse(vetoState.killerEscolhido) : [];
  const finalKillers = [...pickedKillers, killers[0]];

  const assignments = createSetAssignments(
    mapas,
    finalKillers,
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
  ]);

  await canalTexto.send({
    nonce: `v-final-${confrontoId}`,
    enforceNonce: true,
    content: `Os times <@&${timeARole.id}> e <@&${timeBRole.id}> definiram todos os Killers para o confronto!
Por favor, confiram na tabela abaixo qual time começará de Killer em cada SET.`,
    embeds: [createSetsReadyEmbed(
      assignments, 
      timeARole.name, 
      timeBRole.name, 
      `<@&${timeARole.id}>`, 
      `<@&${timeBRole.id}>`
    )],
  });

  try {
    await prisma.vetoState.deleteMany({ where: { confrontoId } });
  } catch (error: unknown) {
    console.error(`[Veto] Confronto ${confrontoId} finalizado, mas o estado de veto nao foi removido:`, error);
  }
}
