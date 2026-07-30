import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { GuildPermissionService } from '../../services/guild-permission-service';

export interface DiscordOAuthGuild {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly owner: boolean;
  readonly permissions: string;
}

export interface BotGuildProvider {
  hasGuild(guildId: string): boolean | Promise<boolean>;
}

export interface MemberRoleResolver {
  resolveRoleIds(guildId: string): Promise<readonly string[] | null>;
}

export type GuildAccessSource = 'owner' | 'manage_guild' | 'admin_role';
export type GuildCapability = 'manage_bot';

export interface AuthorizedGuild {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly accessSource: GuildAccessSource;
  readonly capabilities: readonly GuildCapability[];
}

export interface GuildAccessService {
  listAuthorizedGuilds(
    oauthGuilds: readonly DiscordOAuthGuild[],
  ): Promise<AuthorizedGuild[]>;
}

export interface GuildAccessDependencies {
  readonly botGuildProvider: BotGuildProvider;
  readonly memberRoleResolver: MemberRoleResolver;
  readonly guildPermissionService: GuildPermissionService;
}

const MANAGE_BOT_CAPABILITIES = ['manage_bot'] as const;

function hasManageGuildPermission(permissions: string): boolean {
  try {
    return new PermissionsBitField(BigInt(permissions)).has(
      PermissionFlagsBits.ManageGuild,
    );
  } catch {
    return false;
  }
}

function toAuthorizedGuild(
  guild: DiscordOAuthGuild,
  accessSource: GuildAccessSource,
): AuthorizedGuild {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    accessSource,
    capabilities: MANAGE_BOT_CAPABILITIES,
  };
}

export function createGuildAccessService(
  dependencies: GuildAccessDependencies,
): GuildAccessService {
  async function authorizeGuild(
    guild: DiscordOAuthGuild,
  ): Promise<AuthorizedGuild | null> {
    try {
      if (!(await dependencies.botGuildProvider.hasGuild(guild.id))) return null;

      if (guild.owner) return toAuthorizedGuild(guild, 'owner');

      if (hasManageGuildPermission(guild.permissions)) {
        return toAuthorizedGuild(guild, 'manage_guild');
      }

      const roleIds = await dependencies.memberRoleResolver.resolveRoleIds(
        guild.id,
      );
      if (roleIds === null) return null;

      const hasConfiguredRole =
        await dependencies.guildPermissionService.hasBotAdminPermission({
          guildId: guild.id,
          hasManageGuild: false,
          roleIds,
        });

      return hasConfiguredRole
        ? toAuthorizedGuild(guild, 'admin_role')
        : null;
    } catch {
      return null;
    }
  }

  async function listAuthorizedGuilds(
    oauthGuilds: readonly DiscordOAuthGuild[],
  ): Promise<AuthorizedGuild[]> {
    const authorizationResults = await Promise.all(
      oauthGuilds.map(authorizeGuild),
    );

    return authorizationResults.filter(
      (guild): guild is AuthorizedGuild => guild !== null,
    );
  }

  return { listAuthorizedGuilds };
}
