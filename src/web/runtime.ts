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
  getOverview(guildId: string): Promise<unknown>;
  getRecentConfrontations(guildId: string): Promise<unknown[]>;
  getPools(guildId: string): Promise<unknown[]>;
  getRanking(guildId: string): Promise<unknown[]>;
  getTeams(guildId: string): Promise<unknown[]>;
  getCommands(guildId: string): Promise<unknown[]>;
  getAudit(guildId: string): Promise<unknown[]>;
  getPoolDetails(guildId: string): Promise<unknown[]>;
  getManagement(guildId: string): Promise<unknown>;
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
  return null;
}

export function createPanelRuntime(client: PanelClient): PanelRuntime {
  function requireGuild(guildId: string) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild not connected');
    return guild;
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
            const member: GuildMember = await guild.members.fetch(userId);
            return [...member.roles.cache.keys()];
          },
        },
        guildPermissionService,
      });
      return accessService.listAuthorizedGuilds(oauthGuilds);
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
      const commands = [...(client.commands?.values() ?? [])]
        .map(command => command.data?.toJSON())
        .filter((command): command is { name: string; description?: string } => Boolean(command?.name))
        .sort((left, right) => left.name.localeCompare(right.name));
      const settings = await createCommandSettingService(
        prismaCommandSettingStore,
        commands.map(command => command.name),
      ).list(guildId);
      const enabledByName = new Map(settings.map(setting => [setting.commandName, setting.enabled]));
      return commands.map(command => ({
        name: command.name,
        description: command.description ?? '',
        enabled: enabledByName.get(command.name) ?? true,
      }));
    },

    getAudit: guildId => auditService.list(guildId),

    getPoolDetails: guildId => poolService.listAll(guildId),

    async getManagement(guildId) {
      const guild = requireGuild(guildId);
      const [roles, channels, adminRoleIds, activeConfrontations] = await Promise.all([
        guild.roles.fetch(),
        guild.channels.fetch(),
        guildPermissionService.listAdminRoleIds(guildId),
        confrontationService.listActive(guildId),
      ]);
      return {
        adminRoleIds,
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
        throw error;
      }

      await auditService.write({
        guildId,
        actorUserId,
        action: action.type,
        entityType: action.type.split('.')[0],
        entityId: actionEntityId(action),
        details: action,
      });
      guildEventBus.publish(guildId, action.type, { result });
      return result;
    },
  };
}
