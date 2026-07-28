import type { Client, Collection, GuildMember, Role } from 'discord.js';
import { auditService } from '../services/audit-service';
import { confrontationService } from '../services/confrontation-service';
import { reportService } from '../services/report-service';
import { guildPermissionService } from '../utils/permissions';
import {
  createGuildAccessService,
  type AuthorizedGuild,
  type DiscordOAuthGuild,
} from './authorization/guild-access';

interface CommandDefinition {
  data?: { toJSON(): { name?: string; description?: string } };
}

interface PanelClient extends Client {
  commands?: Collection<string, CommandDefinition>;
}

export interface PanelRuntime {
  isReady(): boolean;
  getGuildCount(): number;
  listAuthorizedGuilds(userId: string, oauthGuilds: readonly DiscordOAuthGuild[]): Promise<AuthorizedGuild[]>;
  getOverview(guildId: string): Promise<unknown>;
  getRecentConfrontations(guildId: string): Promise<unknown[]>;
  getPools(guildId: string): Promise<unknown[]>;
  getRanking(guildId: string): Promise<unknown[]>;
  getTeams(guildId: string): Promise<unknown[]>;
  getCommands(): Promise<unknown[]>;
  getAudit(guildId: string): Promise<unknown[]>;
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

    async getCommands() {
      return [...(client.commands?.values() ?? [])]
        .map(command => command.data?.toJSON())
        .filter((command): command is { name: string; description?: string } => Boolean(command?.name))
        .map(command => ({ name: command.name, description: command.description ?? '' }))
        .sort((left, right) => left.name.localeCompare(right.name));
    },

    getAudit: guildId => auditService.list(guildId),
  };
}
