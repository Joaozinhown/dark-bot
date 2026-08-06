"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasLiveGuildAccess = hasLiveGuildAccess;
exports.createPanelRuntime = createPanelRuntime;
const discord_js_1 = require("discord.js");
const audit_service_1 = require("../services/audit-service");
const confrontation_service_1 = require("../services/confrontation-service");
const command_setting_service_1 = require("../services/command-setting-service");
const pool_service_1 = require("../services/pool-service");
const report_service_1 = require("../services/report-service");
const role_service_1 = require("../services/role-service");
const veto_1 = require("../systems/veto");
const channels_1 = require("../utils/channels");
const embeds_1 = require("../utils/embeds");
const permissions_1 = require("../utils/permissions");
const guild_access_1 = require("./authorization/guild-access");
const event_bus_1 = require("./realtime/event-bus");
const panel_actions_1 = require("./panel-actions");
const service_1 = require("../custom-commands/service");
const registry_1 = require("../custom-commands/registry");
const script_access_1 = require("../custom-commands/script-access");
const executor_1 = require("../custom-commands/executor");
const env_1 = require("../utils/env");
const startup_1 = require("../startup");
const runtime_log_service_1 = require("../services/runtime-log-service");
function poolFailure(error) {
    const messages = {
        POOL_NOT_FOUND: 'Pool nao encontrada neste servidor.',
        MAP_ALREADY_EXISTS: 'Este mapa ja existe na pool.',
        MAP_NOT_FOUND: 'Mapa nao encontrado na pool.',
        KILLER_ALREADY_EXISTS: 'Este killer ja existe na pool.',
        KILLER_NOT_FOUND: 'Killer nao encontrado na pool.',
    };
    const statusCode = error.reason.endsWith('_NOT_FOUND') ? 404 : 409;
    return new panel_actions_1.PanelActionError(error.reason, messages[error.reason], statusCode);
}
function confrontationFailure(error) {
    const statusCode = ['NOT_FOUND', 'POOL_NOT_FOUND'].includes(error.code)
        ? 404
        : error.code === 'ALREADY_CLOSED' ? 409 : 400;
    return new panel_actions_1.PanelActionError(error.code, error.message, statusCode);
}
async function requireRole(guild, roleId, mustBeEditable = true) {
    const role = await guild.roles.fetch(roleId);
    if (!role || role.id === guild.id) {
        throw new panel_actions_1.PanelActionError('ROLE_NOT_FOUND', 'Cargo nao encontrado neste servidor.', 404);
    }
    if (role.managed || (mustBeEditable && !role.editable)) {
        throw new panel_actions_1.PanelActionError('ROLE_NOT_EDITABLE', 'O bot nao pode gerenciar este cargo.', 409);
    }
    return role;
}
function actionEntityId(action) {
    if ('poolId' in action)
        return String(action.poolId);
    if ('roleId' in action)
        return action.roleId;
    if ('commandName' in action)
        return action.commandName;
    if ('confrontationId' in action)
        return String(action.confrontationId);
    if ('commandId' in action && action.commandId !== null)
        return String(action.commandId);
    return null;
}
function safeAuditDetails(action) {
    if (action.type === 'command.save-draft' || action.type === 'command.preview') {
        return {
            type: action.type,
            commandId: 'commandId' in action ? action.commandId : null,
            commandName: action.definition.command.name.ptBR,
            executionMode: action.definition.execution.mode,
            hasScript: service_1.customCommandService.containsScript(action.definition),
        };
    }
    return action;
}
async function fetchLiveGuildMember(guild, userId) {
    return guild.members.fetch({ user: userId, force: true });
}
async function hasLiveGuildAccess(guild, userId) {
    try {
        const member = await fetchLiveGuildMember(guild, userId);
        return permissions_1.guildPermissionService.hasBotAdminPermission({
            guildId: guild.id,
            hasManageGuild: guild.ownerId === userId
                || member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild),
            roleIds: [...member.roles.cache.keys()],
        });
    }
    catch {
        return false;
    }
}
function createPanelRuntime(client) {
    function requireGuild(guildId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild)
            throw new Error('Guild not connected');
        return guild;
    }
    function nativePayloads() {
        return [...(client.commands?.values() ?? [])]
            .map(command => command.data?.toJSON())
            .filter((payload) => Boolean(payload && typeof payload === 'object'));
    }
    function nativeSources() {
        return (0, registry_1.createNativeCommandSources)(nativePayloads());
    }
    async function syncCommands(guild) {
        const token = (0, env_1.getDiscordToken)();
        if (!token)
            throw new panel_actions_1.PanelActionError('DISCORD_TOKEN_MISSING', 'Token do Discord indisponivel.', 503);
        await (0, startup_1.syncGuildCommands)(token, guild, nativePayloads());
    }
    async function scriptSubject(guild, userId) {
        const member = await fetchLiveGuildMember(guild, userId);
        return {
            guildId: guild.id,
            userId,
            roleIds: [...member.roles.cache.keys()],
            isGuildOwner: guild.ownerId === userId,
            hasManageGuild: member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild),
        };
    }
    async function requireScriptAccess(guild, userId) {
        if (!(await script_access_1.scriptAccessService.canUseScripts(await scriptSubject(guild, userId)))) {
            throw new panel_actions_1.PanelActionError('SCRIPT_ACCESS_DENIED', 'Voce nao possui permissao para editar ou publicar scripts.', 403);
        }
    }
    return {
        isReady: () => client.isReady(),
        getGuildCount: () => client.guilds.cache.size,
        getCommandCount: () => client.commands?.size ?? 0,
        listAuthorizedGuilds(userId, oauthGuilds) {
            const accessService = (0, guild_access_1.createGuildAccessService)({
                botGuildProvider: {
                    hasGuild: guildId => client.guilds.cache.has(guildId),
                },
                memberRoleResolver: {
                    async resolveRoleIds(guildId) {
                        const guild = client.guilds.cache.get(guildId);
                        if (!guild)
                            return null;
                        const member = await fetchLiveGuildMember(guild, userId);
                        return [...member.roles.cache.keys()];
                    },
                },
                guildPermissionService: permissions_1.guildPermissionService,
            });
            return accessService.listAuthorizedGuilds(oauthGuilds);
        },
        async hasGuildAccess(userId, guildId) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild)
                return false;
            return hasLiveGuildAccess(guild, userId);
        },
        async getOverview(guildId) {
            const [summary, confrontations, pools] = await Promise.all([
                report_service_1.reportService.getSummary(guildId),
                confrontation_service_1.confrontationService.listActive(guildId),
                report_service_1.reportService.listPoolReports(guildId),
            ]);
            return { summary, confrontations, pools };
        },
        getRecentConfrontations: guildId => report_service_1.reportService.listRecentConfrontations(guildId),
        getPools: guildId => report_service_1.reportService.listPoolReports(guildId),
        getRanking(guildId) {
            const guild = requireGuild(guildId);
            return report_service_1.reportService.getRanking(guildId, async (roleId) => (await guild.roles.fetch(roleId))?.name ?? null);
        },
        async getTeams(guildId) {
            const guild = requireGuild(guildId);
            const roles = await guild.roles.fetch();
            return [...roles.values()]
                .filter(role => role.id !== guild.id && !role.managed)
                .sort((left, right) => right.position - left.position)
                .map(role => ({
                id: role.id,
                name: role.name,
                color: role.hexColor,
                memberCount: role.members.size,
                position: role.position,
            }));
        },
        async getCommands(guildId) {
            const commands = nativePayloads()
                .filter((command) => Boolean(command.name))
                .sort((left, right) => left.name.localeCompare(right.name));
            const settings = await (0, command_setting_service_1.createCommandSettingService)(command_setting_service_1.prismaCommandSettingStore, commands.map(command => command.name)).list(guildId);
            const enabledByName = new Map(settings.map(setting => [setting.commandName, setting.enabled]));
            const catalog = await service_1.customCommandService.listCatalog(guildId, nativeSources());
            return catalog.map(command => ({
                ...command,
                enabled: command.id === null
                    ? enabledByName.get(command.name) ?? true
                    : command.enabled,
            }));
        },
        async getAudit(guildId) {
            const guild = requireGuild(guildId);
            const entries = await audit_service_1.auditService.list(guildId);
            const actorIds = [...new Set(entries.map(entry => entry.actorUserId))];
            const actors = new Map();
            await Promise.all(actorIds.map(async (actorId) => {
                const cached = guild.members.cache.get(actorId);
                const member = cached ?? await guild.members.fetch(actorId).catch(() => null);
                if (member)
                    actors.set(actorId, { displayName: member.displayName, username: member.user.username });
            }));
            return entries.map(entry => ({
                ...entry,
                actorDisplayName: actors.get(entry.actorUserId)?.displayName
                    ?? (typeof entry.details.actorDisplayName === 'string' ? entry.details.actorDisplayName : entry.actorUserId),
                actorUsername: actors.get(entry.actorUserId)?.username
                    ?? (typeof entry.details.actorUsername === 'string' ? entry.details.actorUsername : null),
            }));
        },
        getPoolDetails: guildId => pool_service_1.poolService.listAll(guildId),
        getLogs: async (guildId) => {
            requireGuild(guildId);
            return runtime_log_service_1.runtimeLogService.getSnapshot();
        },
        async getManagement(guildId) {
            const guild = requireGuild(guildId);
            const [roles, channels, adminRoleIds, activeConfrontations, scriptAccess] = await Promise.all([
                guild.roles.fetch(),
                guild.channels.fetch(),
                permissions_1.guildPermissionService.listAdminRoleIds(guildId),
                confrontation_service_1.confrontationService.listActive(guildId),
                script_access_1.scriptAccessService.get(guildId),
            ]);
            return {
                adminRoleIds,
                scriptRoleIds: scriptAccess.roleIds,
                scriptUserIds: scriptAccess.userIds,
                activeConfrontations,
                roles: [...roles.values()]
                    .filter(role => role.id !== guild.id && !role.managed)
                    .sort((left, right) => right.position - left.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor,
                    memberCount: role.members.size,
                    position: role.position,
                    editable: role.editable,
                })),
                channels: [...channels.values()]
                    .filter(channel => channel?.type === discord_js_1.ChannelType.GuildText)
                    .filter(channel => channel.permissionsFor(client.user)?.has(discord_js_1.PermissionFlagsBits.SendMessages))
                    .sort((left, right) => left.position - right.position)
                    .map(channel => ({ id: channel.id, name: channel.name })),
            };
        },
        async executeAction(guildId, actorUserId, action) {
            const guild = requireGuild(guildId);
            let result;
            try {
                switch (action.type) {
                    case 'pool.create':
                        result = await pool_service_1.poolService.create(guildId, action.name, action.format);
                        break;
                    case 'pool.add-map':
                    case 'pool.remove-map':
                    case 'pool.add-killer':
                    case 'pool.remove-killer':
                    case 'pool.toggle':
                    case 'pool.delete': {
                        const operation = action.type === 'pool.add-map'
                            ? pool_service_1.poolService.addMap(guildId, action.poolId, action.name)
                            : action.type === 'pool.remove-map'
                                ? pool_service_1.poolService.removeMap(guildId, action.poolId, action.name)
                                : action.type === 'pool.add-killer'
                                    ? pool_service_1.poolService.addKiller(guildId, action.poolId, action.name)
                                    : action.type === 'pool.remove-killer'
                                        ? pool_service_1.poolService.removeKiller(guildId, action.poolId, action.name)
                                        : action.type === 'pool.toggle'
                                            ? pool_service_1.poolService.toggle(guildId, action.poolId)
                                            : pool_service_1.poolService.delete(guildId, action.poolId);
                        const operationResult = await operation;
                        if (!operationResult.ok)
                            throw poolFailure(operationResult);
                        result = operationResult.value;
                        break;
                    }
                    case 'team.create': {
                        const color = (0, role_service_1.parseTeamRoleColor)(action.color);
                        if (color === null)
                            throw new panel_actions_1.PanelActionError('INVALID_COLOR', 'Cor hexadecimal invalida.');
                        result = await (0, role_service_1.createTeamRole)(guild.roles, {
                            name: action.name,
                            color,
                            createdBy: actorUserId,
                        });
                        break;
                    }
                    case 'team.rename': {
                        const role = await requireRole(guild, action.roleId);
                        await (0, role_service_1.renameTeamRole)(role, action.name);
                        result = { id: role.id, name: action.name };
                        break;
                    }
                    case 'team.delete': {
                        const role = await requireRole(guild, action.roleId);
                        const deleted = { id: role.id, name: role.name };
                        await (0, role_service_1.deleteTeamRole)(role);
                        result = deleted;
                        break;
                    }
                    case 'team.member-add':
                    case 'team.member-remove': {
                        const role = await requireRole(guild, action.roleId);
                        const member = await guild.members.fetch(action.userId);
                        if (action.type === 'team.member-add') {
                            await (0, role_service_1.addMemberToTeamRole)(member.roles, role.id);
                        }
                        else {
                            await (0, role_service_1.removeMemberFromTeamRole)(member.roles, role.id);
                        }
                        result = { roleId: role.id, userId: member.id };
                        break;
                    }
                    case 'permission.set-admin-roles': {
                        await Promise.all(action.roleIds.map(roleId => requireRole(guild, roleId, false)));
                        await permissions_1.guildPermissionService.setAdminRoleIds(guildId, action.roleIds);
                        result = { roleIds: [...new Set(action.roleIds)] };
                        break;
                    }
                    case 'permission.set-script-access': {
                        const subject = await scriptSubject(guild, actorUserId);
                        if (!script_access_1.scriptAccessService.canManageConfig(subject)) {
                            throw new panel_actions_1.PanelActionError('SCRIPT_CONFIG_DENIED', 'Somente dono ou Gerenciar Servidor pode alterar acesso a scripts.', 403);
                        }
                        await Promise.all(action.roleIds.map(roleId => requireRole(guild, roleId, false)));
                        await Promise.all(action.userIds.map(userId => guild.members.fetch(userId)));
                        result = await script_access_1.scriptAccessService.set(guildId, action.roleIds, action.userIds, actorUserId);
                        break;
                    }
                    case 'command.set-enabled': {
                        const commandService = (0, command_setting_service_1.createCommandSettingService)(command_setting_service_1.prismaCommandSettingStore, [...(client.commands?.keys() ?? [])]);
                        result = await commandService.setEnabled({
                            guildId,
                            commandName: action.commandName,
                            enabled: action.enabled,
                            updatedByUserId: actorUserId,
                        });
                        break;
                    }
                    case 'command.save-draft': {
                        const stored = action.commandId === null
                            ? null
                            : await service_1.customCommandService.get(guildId, action.commandId);
                        if (service_1.customCommandService.containsScript(action.definition)
                            || (stored && service_1.customCommandService.containsScript(stored.definition))) {
                            await requireScriptAccess(guild, actorUserId);
                        }
                        result = await service_1.customCommandService.saveDraft({
                            guildId,
                            actorUserId,
                            commandId: action.commandId,
                            sourceType: action.sourceType,
                            factoryCommandName: action.factoryCommandName,
                            definition: action.definition,
                            nativeCommands: nativeSources(),
                        });
                        break;
                    }
                    case 'command.preview': {
                        if (service_1.customCommandService.containsScript(action.definition)) {
                            await requireScriptAccess(guild, actorUserId);
                        }
                        result = await (0, executor_1.simulateDefinition)(action.definition, {
                            ...action.simulation,
                            userId: actorUserId,
                            guildId,
                            guildName: guild.name,
                        });
                        break;
                    }
                    case 'command.publish': {
                        const command = await service_1.customCommandService.get(guildId, action.commandId);
                        if (service_1.customCommandService.containsScript(command.definition)) {
                            await requireScriptAccess(guild, actorUserId);
                        }
                        result = await service_1.customCommandService.publish(guildId, action.commandId, actorUserId);
                        try {
                            await syncCommands(guild);
                        }
                        catch (error) {
                            await service_1.customCommandService.markSyncError(action.commandId);
                            throw new panel_actions_1.PanelActionError('COMMAND_SYNC_FAILED', `Rascunho publicado, mas sincronizacao Discord falhou: ${error instanceof Error ? error.message : String(error)}`, 502);
                        }
                        break;
                    }
                    case 'command.rollback': {
                        const command = await service_1.customCommandService.get(guildId, action.commandId);
                        const version = command.versions.find(item => item.id === action.versionId);
                        if (service_1.customCommandService.containsScript(command.definition)
                            || (version && service_1.customCommandService.containsScript(version.definition))) {
                            await requireScriptAccess(guild, actorUserId);
                        }
                        result = await service_1.customCommandService.rollback(guildId, action.commandId, action.versionId, actorUserId);
                        await syncCommands(guild);
                        break;
                    }
                    case 'command.archive': {
                        const command = await service_1.customCommandService.get(guildId, action.commandId);
                        if (service_1.customCommandService.containsScript(command.definition)) {
                            await requireScriptAccess(guild, actorUserId);
                        }
                        result = await service_1.customCommandService.archive(guildId, action.commandId, actorUserId);
                        await syncCommands(guild);
                        break;
                    }
                    case 'command.clone': {
                        const targetGuild = client.guilds.cache.get(action.targetGuildId);
                        if (!targetGuild) {
                            throw new panel_actions_1.PanelActionError('TARGET_GUILD_NOT_FOUND', 'Servidor de destino nao esta conectado.', 404);
                        }
                        const command = await service_1.customCommandService.get(guildId, action.commandId);
                        if (service_1.customCommandService.containsScript(command.definition)) {
                            await requireScriptAccess(guild, actorUserId);
                            await requireScriptAccess(targetGuild, actorUserId);
                        }
                        result = await service_1.customCommandService.clone(guildId, action.commandId, action.targetGuildId, actorUserId, action.name, nativeSources());
                        break;
                    }
                    case 'command.set-dynamic-enabled': {
                        const command = await service_1.customCommandService.get(guildId, action.commandId);
                        if (service_1.customCommandService.containsScript(command.definition)) {
                            await requireScriptAccess(guild, actorUserId);
                        }
                        result = await service_1.customCommandService.setEnabled(guildId, action.commandId, action.enabled, actorUserId);
                        await syncCommands(guild);
                        break;
                    }
                    case 'confrontation.create': {
                        const [teamA, teamB] = await Promise.all([
                            requireRole(guild, action.teamARoleId, false),
                            requireRole(guild, action.teamBRoleId, false),
                        ]);
                        const channel = await guild.channels.fetch(action.channelId);
                        if (!(channel instanceof discord_js_1.TextChannel)) {
                            throw new panel_actions_1.PanelActionError('CHANNEL_NOT_TEXT', 'Selecione um canal de texto valido.', 400);
                        }
                        const created = await confrontation_service_1.confrontationService.create({
                            guildId,
                            poolId: action.poolId,
                            timeARoleId: action.teamARoleId,
                            timeBRoleId: action.teamBRoleId,
                            channelId: action.channelId,
                        });
                        const confrontationData = { ...created, pool: created.poolId };
                        await channel.send({ embeds: [(0, embeds_1.createConfrontoEmbed)(confrontationData, teamA.name, teamB.name)] });
                        await (0, veto_1.startVeto)(guild, created.id, created.poolConfig, created.primeiroKiller, channel);
                        result = created;
                        break;
                    }
                    case 'confrontation.result': {
                        const recorded = await confrontation_service_1.confrontationService.recordResult(action.confrontationId, action.winnerRoleId, guildId);
                        const winnerRole = await requireRole(guild, action.winnerRoleId, false);
                        if (recorded.updated.channelId) {
                            const channel = await guild.channels.fetch(recorded.updated.channelId);
                            if (channel?.isTextBased()) {
                                const confrontationData = {
                                    ...recorded.updated,
                                    pool: recorded.updated.poolId,
                                    vencedor: recorded.winner,
                                };
                                await channel.send({ embeds: [(0, embeds_1.createResultadoEmbed)(confrontationData, winnerRole.name)] });
                            }
                        }
                        result = recorded;
                        break;
                    }
                    case 'confrontation.close': {
                        const closed = await confrontation_service_1.confrontationService.close(action.confrontationId, action.reason, guildId);
                        if (closed.channelId) {
                            const channel = await guild.channels.fetch(closed.channelId);
                            if (channel?.isTextBased()) {
                                await channel.send({ embeds: [(0, embeds_1.createEncerramentoEmbed)(closed.id, action.reason ?? undefined)] });
                            }
                        }
                        await (0, channels_1.deleteConfrontoVoiceChannels)(guild, closed.vozTimeAId, closed.vozTimeBId);
                        result = closed;
                        break;
                    }
                }
            }
            catch (error) {
                if (error instanceof panel_actions_1.PanelActionError)
                    throw error;
                if (error instanceof confrontation_service_1.ConfrontationServiceError)
                    throw confrontationFailure(error);
                if (error instanceof command_setting_service_1.CommandSettingServiceError) {
                    throw new panel_actions_1.PanelActionError(error.code, error.message, 400);
                }
                if (error instanceof service_1.CustomCommandError) {
                    throw new panel_actions_1.PanelActionError(error.code, error.message, error.statusCode);
                }
                throw error;
            }
            await audit_service_1.auditService.write({
                guildId,
                actorUserId,
                action: action.type,
                entityType: action.type.split('.')[0],
                entityId: actionEntityId(action),
                details: safeAuditDetails(action),
            });
            event_bus_1.guildEventBus.publish(guildId, action.type, { result });
            return result;
        },
    };
}
//# sourceMappingURL=runtime.js.map