"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startVeto = startVeto;
exports.handleBanSelection = handleBanSelection;
const discord_js_1 = require("discord.js");
const client_1 = __importDefault(require("../database/client"));
const veto_selection_service_1 = require("../services/veto-selection-service");
const embeds_1 = require("../utils/embeds");
const event_bus_1 = require("../web/realtime/event-bus");
const veto_rules_1 = require("./veto-rules");
const VETO_STEP_SEND_ATTEMPTS = 3;
const VETO_STEP_RETRY_DELAY_MS = 750;
async function sendVetoStepWithRetry(guild, confrontoId, channel) {
    let lastError;
    for (let attempt = 1; attempt <= VETO_STEP_SEND_ATTEMPTS; attempt += 1) {
        try {
            await sendVetoStep(guild, confrontoId, channel);
            return;
        }
        catch (error) {
            lastError = error;
            if (attempt < VETO_STEP_SEND_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, VETO_STEP_RETRY_DELAY_MS));
            }
        }
    }
    throw lastError;
}
async function startVeto(guild, confrontoId, poolConfig, primeiroKiller, canalTexto) {
    await client_1.default.vetoState.create({
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
async function sendVetoStep(guild, confrontoId, canalTexto) {
    const vetoState = await client_1.default.vetoState.findUnique({
        where: { confrontoId },
    });
    if (!vetoState)
        return;
    const confronto = await client_1.default.confronto.findUnique({
        where: { id: confrontoId },
    });
    if (!confronto)
        return;
    const killers = JSON.parse(vetoState.killersRestantes);
    if (killers.length <= 1) {
        await finalizeVeto(guild, confrontoId, canalTexto);
        return;
    }
    const stepIndex = vetoState.set;
    const { action, isTiebreak } = (0, veto_rules_1.getVetoAction)(confronto.formato, stepIndex);
    const timeARole = await guild.roles.fetch(confronto.timeARoleId);
    const timeBRole = await guild.roles.fetch(confronto.timeBRoleId);
    if (!timeARole || !timeBRole)
        return;
    const vezRole = vetoState.vezDe === 'A' ? timeARole : timeBRole;
    const embed = (0, embeds_1.createVetoEmbed)(action, killers, vezRole.name, isTiebreak);
    const banSelect = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`killer-ban:${confrontoId}`)
        .setPlaceholder(action === 'pick' ? 'Escolha um killer para jogar' : 'Escolha um killer para banir')
        .addOptions(killers.map((killer, index) => ({
        label: killer.slice(0, 100),
        value: killer,
        description: `${index + 1} de ${killers.length}`,
    })));
    const row = new discord_js_1.ActionRowBuilder().addComponents(banSelect);
    const actionTextContent = action === 'pick' ? 'escolher o Killer' : 'banir um Killer';
    const message = await canalTexto.send({
        nonce: `v-${confrontoId}-${stepIndex}`,
        enforceNonce: true,
        content: `<@&${vezRole.id}>, chegou a vez do seu time **${actionTextContent}**!`,
        embeds: [embed],
        components: [row],
    });
    try {
        const updated = await client_1.default.vetoState.updateMany({
            where: { confrontoId, set: stepIndex, messageId: null },
            data: { messageId: message.id },
        });
        if (updated.count !== 1) {
            const currentState = await client_1.default.vetoState.findUnique({ where: { confrontoId } });
            if (currentState?.messageId !== message.id) {
                await message.delete().catch(() => undefined);
            }
        }
    }
    catch (error) {
        let currentState;
        try {
            currentState = await client_1.default.vetoState.findUnique({ where: { confrontoId } });
        }
        catch {
            throw error;
        }
        if (currentState?.messageId === message.id)
            return;
        await message.delete().catch(() => undefined);
        throw error;
    }
}
async function handleBanSelection(interaction, confrontoId) {
    const vetoState = await client_1.default.vetoState.findUnique({
        where: { confrontoId },
    });
    if (!vetoState || vetoState.tipo !== 'killer') {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Estado de veto nao encontrado. Use a mensagem mais recente.')],
            flags: 64,
        });
        return;
    }
    const confronto = await client_1.default.confronto.findUnique({
        where: { id: confrontoId },
    });
    if (!confronto) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Confronto nao encontrado.')],
            flags: 64,
        });
        return;
    }
    if (interaction.guildId !== confronto.guildId
        || interaction.channelId !== confronto.channelId) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Esta interacao nao pertence ao canal deste confronto.')],
            flags: 64,
        });
        return;
    }
    if (!vetoState.messageId || interaction.message.id !== vetoState.messageId) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Esta etapa ja expirou. Use a mensagem mais recente.')],
            flags: 64,
        });
        return;
    }
    const timeARole = await interaction.guild.roles.fetch(confronto.timeARoleId);
    const timeBRole = await interaction.guild.roles.fetch(confronto.timeBRoleId);
    if (!timeARole || !timeBRole) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Time nao encontrado.')],
            flags: 64,
        });
        return;
    }
    const vezRoleId = vetoState.vezDe === 'A' ? timeARole.id : timeBRole.id;
    const member = interaction.member;
    if (!member?.roles.cache.has(vezRoleId)) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Nao e a vez do seu time.')],
            flags: 64,
        });
        return;
    }
    await interaction.deferUpdate();
    const selectedKiller = interaction.values[0];
    if (!selectedKiller) {
        await interaction.followUp({
            embeds: [(0, embeds_1.createErrorEmbed)('Nenhum killer foi selecionado.')],
            flags: 64,
        });
        return;
    }
    let selection;
    try {
        selection = await veto_selection_service_1.vetoSelectionService.select({
            guildId: confronto.guildId,
            channelId: interaction.channelId,
            confrontationId: confrontoId,
            format: confronto.formato,
            stepIndex: vetoState.set,
            turn: vetoState.vezDe,
            messageId: interaction.message.id,
            killersSerialized: vetoState.killersRestantes,
            pickedKillersSerialized: vetoState.killerEscolhido ?? '[]',
            killer: selectedKiller,
            actor: {
                userId: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.user.globalName ?? interaction.user.displayName,
                teamSide: vetoState.vezDe,
                teamRoleId: vezRoleId,
                teamRoleName: vetoState.vezDe === 'A' ? timeARole.name : timeBRole.name,
            },
        });
    }
    catch (error) {
        const message = error instanceof veto_selection_service_1.VetoSelectionServiceError
            ? error.message
            : 'Nao foi possivel registrar esta escolha. Tente novamente pela mensagem mais recente.';
        if (!(error instanceof veto_selection_service_1.VetoSelectionServiceError)) {
            console.error(`[Veto] Falha ao registrar escolha no confronto ${confrontoId}:`, error);
        }
        await interaction.followUp({ embeds: [(0, embeds_1.createErrorEmbed)(message)], flags: 64 });
        return;
    }
    const proximoTimeName = selection.nextTurn === 'A' ? timeARole.name : timeBRole.name;
    const currentTeamName = vetoState.vezDe === 'A' ? timeARole.name : timeBRole.name;
    const verbText = selection.action === 'pick' ? 'escolheu' : 'baniu';
    let editFailure;
    try {
        await interaction.editReply({
            content: `O time **${currentTeamName}** ${verbText} o Killer **${selection.selectedKiller}**!`,
            embeds: [(0, embeds_1.createBanEmbed)(selection.action, currentTeamName, selection.selectedKiller, proximoTimeName, selection.remainingKillers.length > 1, selection.isTiebreak)],
            components: [],
        });
    }
    catch (error) {
        editFailure = error;
        console.error(`[Veto] Escolha persistida, mas a mensagem ${interaction.message.id} nao foi atualizada:`, error);
    }
    event_bus_1.guildEventBus.publish(confronto.guildId, `veto.${selection.action}`, {
        confrontationId: confrontoId,
        actorUserId: interaction.user.id,
        killer: selection.selectedKiller,
        setNumber: selection.setNumber,
    });
    try {
        await sendVetoStepWithRetry(interaction.guild, confrontoId, interaction.channel);
    }
    catch (error) {
        console.error(`[Veto] Escolha persistida, mas a proxima etapa do confronto ${confrontoId} nao foi enviada:`, error);
        await interaction.followUp({
            embeds: [(0, embeds_1.createErrorEmbed)('A escolha foi registrada, mas a proxima etapa nao foi enviada apos tres tentativas. Avise a staff.')],
            flags: 64,
        });
        return;
    }
    if (editFailure) {
        await interaction.followUp({
            embeds: [(0, embeds_1.createErrorEmbed)('A escolha foi registrada, mas a mensagem anterior nao pôde ser atualizada. Use a nova etapa enviada no canal.')],
            flags: 64,
        });
    }
}
async function finalizeVeto(guild, confrontoId, canalTexto) {
    const vetoState = await client_1.default.vetoState.findUnique({
        where: { confrontoId },
    });
    const confronto = await client_1.default.confronto.findUnique({
        where: { id: confrontoId },
    });
    if (!vetoState || !confronto?.primeiroKiller)
        return;
    const timeARole = await guild.roles.fetch(confronto.timeARoleId);
    const timeBRole = await guild.roles.fetch(confronto.timeBRoleId);
    if (!timeARole || !timeBRole)
        return;
    const mapas = JSON.parse(vetoState.mapasRestantes);
    const killers = JSON.parse(vetoState.killersRestantes);
    const pickedKillers = vetoState.killerEscolhido ? JSON.parse(vetoState.killerEscolhido) : [];
    const finalKillers = [...pickedKillers, killers[0]];
    const assignments = (0, veto_rules_1.createSetAssignments)(mapas, finalKillers, confronto.primeiroKiller);
    await client_1.default.$transaction([
        client_1.default.set.deleteMany({ where: { confrontoId } }),
        client_1.default.set.createMany({
            data: assignments.map(assignment => ({
                confrontoId,
                numero: assignment.numero,
                mapaUsado: assignment.mapa,
                killerUsado: assignment.killer,
                killerTime: assignment.killerTime,
            })),
        }),
        client_1.default.confronto.update({
            where: { id: confrontoId },
            data: { status: 'em_andamento', currentSet: 1 },
        }),
    ]);
    await canalTexto.send({
        nonce: `v-final-${confrontoId}`,
        enforceNonce: true,
        content: `Os times <@&${timeARole.id}> e <@&${timeBRole.id}> definiram todos os Killers para o confronto!
Por favor, confiram na tabela abaixo qual time começará de Killer em cada SET.`,
        embeds: [(0, embeds_1.createSetsReadyEmbed)(assignments, timeARole.name, timeBRole.name, `<@&${timeARole.id}>`, `<@&${timeBRole.id}>`)],
    });
    try {
        await client_1.default.vetoState.deleteMany({ where: { confrontoId } });
    }
    catch (error) {
        console.error(`[Veto] Confronto ${confrontoId} finalizado, mas o estado de veto nao foi removido:`, error);
    }
}
//# sourceMappingURL=veto.js.map