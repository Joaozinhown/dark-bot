import {
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  type Client,
  type Collection,
  type Guild,
  type GuildMember,
  type Role,
} from 'discord.js';
import { auditService } from '../services/audit-service';
import {
  confrontationService,
  ConfrontationServiceError,
} from '../services/confrontation-service';
import {
  CommandSettingServiceError,
  createCommandSettingService,
  prismaCommandSettingStore,
} from '../services/command-setting-service';
import { poolService, type PoolFailure } from '../services/pool-service';
import { reportService } from '../services/report-service';
import {
  addMemberToTeamRole,
  createTeamRole,
  deleteTeamRole,
  parseTeamRoleColor,
  removeMemberFromTeamRole,
  renameTeamRole,
} from '../services/role-service';
import { startVeto } from '../systems/veto';
import type { ConfrontoData } from '../types/index';
import { deleteConfrontoVoiceChannels } from '../utils/channels';
import {
  createConfrontoEmbed,
  createEncerramentoEmbed,
  createResultadoEmbed,
} from '../utils/embeds';
import { guildPermissionService } from '../utils/permissions';
import {
  createGuildAccessService,
  type AuthorizedGuild,
  type DiscordOAuthGuild,
} from './authorization/guild-access';
import { guildEventBus } from './realtime/event-bus';
import { PanelActionError, type PanelAction } from './panel-actions';
import {
  CustomCommandError,
  customCommandService,
} from '../custom-commands/service';
import { createNativeCommandSources } from '../custom-commands/registry';
import { scriptAccessService, type ScriptAccessSubject } from '../custom-commands/script-access';
import { simulateDefinition } from '../custom-commands/executor';
import { getDiscordToken } from '../utils/env';
import { syncGuildCommands } from '../startup';
import { runtimeLogService } from '../services/runtime-log-service';

interface CommandDefinition {
  data?: { toJSON(): { name?: string; description?: string } };
}

interface PanelClient extends Client {
  commands?: Collection<string, CommandDefinition>;
}

export interface PanelRuntime {
  isReady(): boolean;
  getGuildCount(): number;
  getCommandCount?(): number;
  listAuthorizedGuilds(userId: string, oauthGuilds: readonly DiscordOAuthGuild[]): Promise<AuthorizedGuild[]>;
  hasGuildAccess(userId: string, guildId: string): Promise<boolean>;
  getOverview(guildId: string): Promise<unknown>;
  getRecentConfrontations(guildId: string): Promise<unknown[]>;
  getPools(guildId: string): Promise<unknown[]>;
  getRanking(guildId: string): Promise<unknown[]>;
  getTeams(guildId: string): Promise<unknown[]>;
  getCommands(guildId: string): Promise<unknown[]>;
  getAudit(guildId: string): Promise<unknown[]>;
  getPoolDetails(guildId: string): Promise<unknown[]>;
  getManagement(guildId: string): Promise<unknown>;
  getLogs(guildId: string): Promise<unknown>;
  executeAction(guildId: string, actorUserId: string, action: PanelAction): Promise<unknown>;
}

function poolFailure(error: PoolFailure): PanelActionError {
  const messages: Record<PoolFailure['reason'], string> = {
    POOL_NOT_FOUND: 'Pool nao encontrada neste servidor.',
    MAP_ALREADY_EXISTS: 'Este mapa ja existe na pool.',
    MAP_NOT_FOUND: 'Mapa nao encontrado na pool.',
    KILLER_ALREADY_EXISTS: 'Este killer ja existe na pool.',
    KILLER_NOT_FOUND: 'Killer nao encontrado na pool.',
  };
  const statusCode = error.reason.endsWith('_NOT_FOUND') ? 404 : 409;
  return new PanelActionError(error.reason, messages[error.reason], statusCode);
}

function confrontationFailure(error: ConfrontationServiceError): PanelActionError {
  const statusCode = ['NOT_FOUND', 'POOL_NOT_FOUND'].includes(error.code)
    ? 404
    : error.code === 'ALREADY_CLOSED' ? 409 : 400;
  return new PanelActionError(error.code, error.message, statusCode);
}

async function requireRole(guild: Guild, roleId: string, mustBeEditable = true): Promise<Role> {
  const role = await guild.roles.fetch(roleId);
  if (!role || role.id === guild.id) {
    throw new PanelActionError('ROLE_NOT_FOUND', 'Cargo nao encontrado neste servidor.', 404);
  }
  if (role.managed || (mustBeEditable && !role.editable)) {
    throw new PanelActionError('ROLE_NOT_EDITABLE', 'O bot nao pode gerenciar este cargo.', 409);
  }
  return role;
}

function actionEntityId(action: PanelAction): string | null {
  if ('poolId' in action) return String(action.poolId);
  if ('roleId' in action) return action.roleId;
  if ('commandName' in action) return action.commandName;
  if ('confrontationId' in action) return String(action.confrontationId);
  if ('commandId' in action && action.commandId !== null) return String(action.commandId);
  return null;
}

function safeAuditDetails(action: PanelAction): Readonly<Record<string, unknown>> {
  if (action.type === 'command.save-draft' || action.type === 'command.preview') {
    return {
      type: action.type,
      commandId: 'commandId' in action ? action.commandId : null,
      commandName: action.definition.command.name.ptBR,
      executionMode: action.definition.execution.mode,
      hasScript: customCommandService.containsScript(action.definition),
    };
  }
  return action;
}

async function fetchLiveGuildMember(guild: Guild, userId: string): Promise<GuildMember> {
  return guild.members.fetch({ user: userId, force: true });
}

export async function hasLiveGuildAccess(guild: Guild, userId: string): Promise<boolean> {
  try {
    const member = await fetchLiveGuildMember(guild, userId);
    return guildPermissionService.hasBotAdminPermission({
      guildId: guild.id,
      hasManageGuild: guild.ownerId === userId
        || member.permissions.has(PermissionFlagsBits.ManageGuild),
      roleIds: [...member.roles.cache.keys()],
    });
  } catch {
    return false;
  }
}

export function createPanelRuntime(client: PanelClient): PanelRuntime {
  function requireGuild(guildId: string) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild not connected');
    return guild;
  }

  function nativePayloads(): Record<string, unknown>[] {
    return [...(client.commands?.values() ?? [])]
      .map(command => command.data?.toJSON())
      .filter((payload): payload is Record<string, unknown> => Boolean(payload && typeof payload === 'object'));
  }

  function nativeSources() {
    return createNativeCommandSources(nativePayloads());
  }

  async function syncCommands(guild: Guild): Promise<void> {
    const token = getDiscordToken();
    if (!token) throw new PanelActionError('DISCORD_TOKEN_MISSING', 'Token do Discord indisponivel.', 503);
    await syncGuildCommands(token, guild, nativePayloads());
  }

  async function scriptSubject(guild: Guild, userId: string): Promise<ScriptAccessSubject> {
    const member = await fetchLiveGuildMember(guild, userId);
    return {
      guildId: guild.id,
      userId,
      roleIds: [...member.roles.cache.keys()],
      isGuildOwner: guild.ownerId === userId,
      hasManageGuild: member.permissions.has(PermissionFlagsBits.ManageGuild),
    };
  }

  async function requireScriptAccess(guild: Guild, userId: string): Promise<void> {
    if (!(await scriptAccessService.canUseScripts(await scriptSubject(guild, userId)))) {
      throw new PanelActionError('SCRIPT_ACCESS_DENIED', 'Voce nao possui permissao para editar ou publicar scripts.', 403);
    }
  }

  return {
    isReady: () => client.isReady(),
    getGuildCount: () => client.guilds.cache.size,
    getCommandCount: () => client.commands?.size ?? 0,

    listAuthorizedGuilds(userId, oauthGuilds) {
      const accessService = createGuildAccessService({
        botGuildProvider: {
          hasGuild: guildId => client.guilds.cache.has(guildId),
        },
        memberRoleResolver: {
          async resolveRoleIds(guildId) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return null;
            const member = await fetchLiveGuildMember(guild, userId);
            return [...member.roles.cache.keys()];
          },
        },
        guildPermissionService,
      });
      return accessService.listAuthorizedGuilds(oauthGuilds);
    },

    async hasGuildAccess(userId, guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return false;
      return hasLiveGuildAccess(guild, userId);
    },

    async getOverview(guildId) {
      const [summary, confrontations, pools] = await Promise.all([
        reportService.getSummary(guildId),
        confrontationService.listActive(guildId),
        reportService.listPoolReports(guildId),
      ]);
      return { summary, confrontations, pools };
    },

    getRecentConfrontations: guildId => reportService.listRecentConfrontations(guildId),
    getPools: guildId => reportService.listPoolReports(guildId),
    getRanking(guildId) {
      const guild = requireGuild(guildId);
      return reportService.getRanking(
        guildId,
        async roleId => (await guild.roles.fetch(roleId))?.name ?? null,
      );
    },

    async getTeams(guildId) {
      const guild = requireGuild(guildId);
      const roles: Collection<string, Role> = await guild.roles.fetch();
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
        .filter((command): command is Record<string, unknown> & { name: string; description?: string } => Boolean(command.name))
        .sort((left, right) => left.name.localeCompare(right.name));
      const settings = await createCommandSettingService(
        prismaCommandSettingStore,
        commands.map(command => command.name),
      ).list(guildId);
      const enabledByName = new Map(settings.map(setting => [setting.commandName, setting.enabled]));
      const catalog = await customCommandService.listCatalog(guildId, nativeSources());
      return catalog.map(command => ({
        ...command,
        enabled: command.id === null
          ? enabledByName.get(command.name) ?? true
          : command.enabled,
      }));
    },

    async getAudit(guildId) {
      const guild = requireGuild(guildId);
      const entries = await auditService.list(guildId);
      const actorIds = [...new Set(entries.map(entry => entry.actorUserId))];
      const actors = new Map<string, { displayName: string; username: string }>();
      await Promise.all(actorIds.map(async actorId => {
        const cached = guild.members.cache.get(actorId);
        const member = cached ?? await guild.members.fetch(actorId).catch(() => null);
        if (member) actors.set(actorId, { displayName: member.displayName, username: member.user.username });
      }));
      return entries.map(entry => ({
        ...entry,
        actorDisplayName: actors.get(entry.actorUserId)?.displayName
          ?? (typeof entry.details.actorDisplayName === 'string' ? entry.details.actorDisplayName : entry.actorUserId),
        actorUsername: actors.get(entry.actorUserId)?.username
          ?? (typeof entry.details.actorUsername === 'string' ? entry.details.actorUsername : null),
      }));
    },

    getPoolDetails: guildId => poolService.listAll(guildId),

    getLogs: async guildId => {
      requireGuild(guildId);
      return runtimeLogService.getSnapshot();
    },

    async getManagement(guildId) {
      const guild = requireGuild(guildId);
      const [roles, channels, adminRoleIds, activeConfrontations, scriptAccess] = await Promise.all([
        guild.roles.fetch(),
        guild.channels.fetch(),
        guildPermissionService.listAdminRoleIds(guildId),
        confrontationService.listActive(guildId),
        scriptAccessService.get(guildId),
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
          .filter(channel => channel?.type === ChannelType.GuildText)
          .filter(channel => channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages))
          .sort((left, right) => left!.position - right!.position)
          .map(channel => ({ id: channel!.id, name: channel!.name })),
      };
    },

    async executeAction(guildId, actorUserId, action) {
      const guild = requireGuild(guildId);
      let result: unknown;

      try {
        switch (action.type) {
          case 'pool.create':
            result = await poolService.create(guildId, action.name, action.format);
            break;
          case 'pool.add-map':
          case 'pool.remove-map':
          case 'pool.add-killer':
          case 'pool.remove-killer':
          case 'pool.toggle':
          case 'pool.delete': {
            const operation = action.type === 'pool.add-map'
              ? poolService.addMap(guildId, action.poolId, action.name)
              : action.type === 'pool.remove-map'
                ? poolService.removeMap(guildId, action.poolId, action.name)
                : action.type === 'pool.add-killer'
                  ? poolService.addKiller(guildId, action.poolId, action.name)
                  : action.type === 'pool.remove-killer'
                    ? poolService.removeKiller(guildId, action.poolId, action.name)
                    : action.type === 'pool.toggle'
                      ? poolService.toggle(guildId, action.poolId)
                      : poolService.delete(guildId, action.poolId);
            const operationResult = await operation;
            if (!operationResult.ok) throw poolFailure(operationResult);
            result = operationResult.value;
            break;
          }
          case 'team.create': {
            const color = parseTeamRoleColor(action.color);
            if (color === null) throw new PanelActionError('INVALID_COLOR', 'Cor hexadecimal invalida.');
            result = await createTeamRole(guild.roles, {
              name: action.name,
              color,
              createdBy: actorUserId,
            });
            break;
          }
          case 'team.rename': {
            const role = await requireRole(guild, action.roleId);
            await renameTeamRole(role, action.name);
            result = { id: role.id, name: action.name };
            break;
          }
          case 'team.delete': {
            const role = await requireRole(guild, action.roleId);
            const deleted = { id: role.id, name: role.name };
            await deleteTeamRole(role);
            result = deleted;
            break;
          }
          case 'team.member-add':
          case 'team.member-remove': {
            const role = await requireRole(guild, action.roleId);
            const member: GuildMember = await guild.members.fetch(action.userId);
            if (action.type === 'team.member-add') {
              await addMemberToTeamRole(member.roles, role.id);
            } else {
              await removeMemberFromTeamRole(member.roles, role.id);
            }
            result = { roleId: role.id, userId: member.id };
            break;
          }
          case 'permission.set-admin-roles': {
            await Promise.all(action.roleIds.map(roleId => requireRole(guild, roleId, false)));
            await guildPermissionService.setAdminRoleIds(guildId, action.roleIds);
            result = { roleIds: [...new Set(action.roleIds)] };
            break;
          }
          case 'permission.set-script-access': {
            const subject = await scriptSubject(guild, actorUserId);
            if (!scriptAccessService.canManageConfig(subject)) {
              throw new PanelActionError('SCRIPT_CONFIG_DENIED', 'Somente dono ou Gerenciar Servidor pode alterar acesso a scripts.', 403);
            }
            await Promise.all(action.roleIds.map(roleId => requireRole(guild, roleId, false)));
            await Promise.all(action.userIds.map(userId => guild.members.fetch(userId)));
            result = await scriptAccessService.set(guildId, action.roleIds, action.userIds, actorUserId);
            break;
          }
          case 'command.set-enabled': {
            const commandService = createCommandSettingService(
              prismaCommandSettingStore,
              [...(client.commands?.keys() ?? [])],
            );
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
              : await customCommandService.get(guildId, action.commandId);
            if (customCommandService.containsScript(action.definition)
              || (stored && customCommandService.containsScript(stored.definition))) {
              await requireScriptAccess(guild, actorUserId);
            }
            result = await customCommandService.saveDraft({
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
            if (customCommandService.containsScript(action.definition)) {
              await requireScriptAccess(guild, actorUserId);
            }
            result = await simulateDefinition(action.definition, {
              ...action.simulation,
              userId: actorUserId,
              guildId,
              guildName: guild.name,
            });
            break;
          }
          case 'command.publish': {
            const command = await customCommandService.get(guildId, action.commandId);
            if (customCommandService.containsScript(command.definition)) {
              await requireScriptAccess(guild, actorUserId);
            }
            result = await customCommandService.publish(guildId, action.commandId, actorUserId);
            try {
              await syncCommands(guild);
            } catch (error: unknown) {
              await customCommandService.markSyncError(action.commandId);
              throw new PanelActionError(
                'COMMAND_SYNC_FAILED',
                `Rascunho publicado, mas sincronizacao Discord falhou: ${error instanceof Error ? error.message : String(error)}`,
                502,
              );
            }
            break;
          }
          case 'command.rollback': {
            const command = await customCommandService.get(guildId, action.commandId);
            const version = command.versions.find(item => item.id === action.versionId);
            if (customCommandService.containsScript(command.definition)
              || (version && customCommandService.containsScript(version.definition))) {
              await requireScriptAccess(guild, actorUserId);
            }
            result = await customCommandService.rollback(guildId, action.commandId, action.versionId, actorUserId);
            await syncCommands(guild);
            break;
          }
          case 'command.archive': {
            const command = await customCommandService.get(guildId, action.commandId);
            if (customCommandService.containsScript(command.definition)) {
              await requireScriptAccess(guild, actorUserId);
            }
            result = await customCommandService.archive(guildId, action.commandId, actorUserId);
            await syncCommands(guild);
            break;
          }
          case 'command.clone': {
            const targetGuild = client.guilds.cache.get(action.targetGuildId);
            if (!targetGuild) {
              throw new PanelActionError('TARGET_GUILD_NOT_FOUND', 'Servidor de destino nao esta conectado.', 404);
            }
            const command = await customCommandService.get(guildId, action.commandId);
            if (customCommandService.containsScript(command.definition)) {
              await requireScriptAccess(guild, actorUserId);
              await requireScriptAccess(targetGuild, actorUserId);
            }
            result = await customCommandService.clone(
              guildId,
              action.commandId,
              action.targetGuildId,
              actorUserId,
              action.name,
              nativeSources(),
            );
            break;
          }
          case 'command.set-dynamic-enabled': {
            const command = await customCommandService.get(guildId, action.commandId);
            if (customCommandService.containsScript(command.definition)) {
              await requireScriptAccess(guild, actorUserId);
            }
            result = await customCommandService.setEnabled(guildId, action.commandId, action.enabled, actorUserId);
            await syncCommands(guild);
            break;
          }
          case 'confrontation.create': {
            const [teamA, teamB] = await Promise.all([
              requireRole(guild, action.teamARoleId, false),
              requireRole(guild, action.teamBRoleId, false),
            ]);
            const channel = await guild.channels.fetch(action.channelId);
            if (!(channel instanceof TextChannel)) {
              throw new PanelActionError('CHANNEL_NOT_TEXT', 'Selecione um canal de texto valido.', 400);
            }
            const created = await confrontationService.create({
              guildId,
              poolId: action.poolId,
              timeARoleId: action.teamARoleId,
              timeBRoleId: action.teamBRoleId,
              channelId: action.channelId,
            });
            const confrontationData: ConfrontoData = { ...created, pool: created.poolId };
            await channel.send({ embeds: [createConfrontoEmbed(confrontationData, teamA.name, teamB.name)] });
            await startVeto(guild, created.id, created.poolConfig, created.primeiroKiller!, channel);
            result = created;
            break;
          }
          case 'confrontation.result': {
            const recorded = await confrontationService.recordResult(
              action.confrontationId,
              action.winnerRoleId,
              guildId,
            );
            const winnerRole = await requireRole(guild, action.winnerRoleId, false);
            if (recorded.updated.channelId) {
              const channel = await guild.channels.fetch(recorded.updated.channelId);
              if (channel?.isTextBased()) {
                const confrontationData: ConfrontoData = {
                  ...recorded.updated,
                  pool: recorded.updated.poolId,
                  vencedor: recorded.winner,
                };
                await channel.send({ embeds: [createResultadoEmbed(confrontationData, winnerRole.name)] });
              }
            }
            result = recorded;
            break;
          }
          case 'confrontation.close': {
            const closed = await confrontationService.close(
              action.confrontationId,
              action.reason,
              guildId,
            );
            if (closed.channelId) {
              const channel = await guild.channels.fetch(closed.channelId);
              if (channel?.isTextBased()) {
                await channel.send({ embeds: [createEncerramentoEmbed(closed.id, action.reason ?? undefined)] });
              }
            }
            await deleteConfrontoVoiceChannels(guild, closed.vozTimeAId, closed.vozTimeBId);
            result = closed;
            break;
          }
        }
      } catch (error: unknown) {
        if (error instanceof PanelActionError) throw error;
        if (error instanceof ConfrontationServiceError) throw confrontationFailure(error);
        if (error instanceof CommandSettingServiceError) {
          throw new PanelActionError(error.code, error.message, 400);
        }
        if (error instanceof CustomCommandError) {
          throw new PanelActionError(error.code, error.message, error.statusCode);
        }
        throw error;
      }

      await auditService.write({
        guildId,
        actorUserId,
        action: action.type,
        entityType: action.type.split('.')[0],
        entityId: actionEntityId(action),
        details: safeAuditDetails(action),
      });
      guildEventBus.publish(guildId, action.type, { result });
      return result;
    },
  };
}
