import assert from 'node:assert/strict';
import test from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import type { GuildPermissionService } from '../../services/guild-permission-service';
import {
  createGuildAccessService,
  type DiscordOAuthGuild,
  type GuildAccessDependencies,
} from './guild-access';

function oauthGuild(
  id: string,
  overrides: Partial<DiscordOAuthGuild> = {},
): DiscordOAuthGuild {
  return {
    id,
    name: `Guild ${id}`,
    icon: null,
    owner: false,
    permissions: '0',
    ...overrides,
  };
}

function createDependencies(options: {
  readonly botGuildIds?: readonly string[];
  readonly memberRoles?: Readonly<Record<string, readonly string[] | null>>;
  readonly configuredRoles?: Readonly<Record<string, readonly string[]>>;
  readonly failingBotGuildIds?: readonly string[];
  readonly failingMemberGuildIds?: readonly string[];
} = {}): GuildAccessDependencies {
  const botGuildIds = new Set(options.botGuildIds ?? []);
  const failingBotGuildIds = new Set(options.failingBotGuildIds ?? []);
  const failingMemberGuildIds = new Set(options.failingMemberGuildIds ?? []);

  const guildPermissionService: GuildPermissionService = {
    listAdminRoleIds: async guildId => [
      ...(options.configuredRoles?.[guildId] ?? []),
    ],
    setAdminRoleIds: async () => undefined,
    addAdminRole: async () => [],
    removeAdminRole: async () => [],
    hasBotAdminPermission: async subject => {
      const configuredRoleIds = new Set(
        options.configuredRoles?.[subject.guildId] ?? [],
      );
      return subject.roleIds.some(roleId => configuredRoleIds.has(roleId));
    },
  };

  return {
    botGuildProvider: {
      async hasGuild(guildId) {
        if (failingBotGuildIds.has(guildId)) throw new Error('fetch failed');
        return botGuildIds.has(guildId);
      },
    },
    memberRoleResolver: {
      async resolveRoleIds(guildId) {
        if (failingMemberGuildIds.has(guildId)) {
          throw new Error('member fetch failed');
        }
        return options.memberRoles?.[guildId] ?? null;
      },
    },
    guildPermissionService,
  };
}

test('returns only OAuth guilds where the bot is connected', async () => {
  const service = createGuildAccessService(
    createDependencies({ botGuildIds: ['shared', 'bot-only'] }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('shared', { owner: true }),
    oauthGuild('oauth-only', { owner: true }),
  ]);

  assert.deepEqual(result.map(guild => guild.id), ['shared']);
});

test('authorizes a guild owner with bot management capability', async () => {
  const service = createGuildAccessService(
    createDependencies({ botGuildIds: ['guild-a'] }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('guild-a', { owner: true }),
  ]);

  assert.deepEqual(result, [
    {
      id: 'guild-a',
      name: 'Guild guild-a',
      icon: null,
      accessSource: 'owner',
      capabilities: ['manage_bot'],
    },
  ]);
});

test('authorizes Manage Guild permission from the OAuth bitfield', async () => {
  const service = createGuildAccessService(
    createDependencies({ botGuildIds: ['guild-a'] }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('guild-a', {
      permissions: PermissionFlagsBits.ManageGuild.toString(),
    }),
  ]);

  assert.equal(result[0]?.accessSource, 'manage_guild');
});

test('authorizes a configured admin role resolved for the same guild', async () => {
  const service = createGuildAccessService(
    createDependencies({
      botGuildIds: ['guild-a'],
      memberRoles: { 'guild-a': ['role-admin'] },
      configuredRoles: { 'guild-a': ['role-admin'] },
    }),
  );

  const result = await service.listAuthorizedGuilds([oauthGuild('guild-a')]);

  assert.equal(result[0]?.accessSource, 'admin_role');
});

test('does not reuse a member role configured in another guild', async () => {
  const service = createGuildAccessService(
    createDependencies({
      botGuildIds: ['guild-a', 'guild-b'],
      memberRoles: {
        'guild-a': ['role-b'],
        'guild-b': ['role-b'],
      },
      configuredRoles: {
        'guild-a': ['role-a'],
        'guild-b': ['role-b'],
      },
    }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('guild-a'),
    oauthGuild('guild-b'),
  ]);

  assert.deepEqual(result.map(guild => guild.id), ['guild-b']);
});

test('denies malformed permissions unless a configured role is proven', async () => {
  const service = createGuildAccessService(
    createDependencies({
      botGuildIds: ['denied', 'role-authorized'],
      memberRoles: {
        denied: [],
        'role-authorized': ['role-admin'],
      },
      configuredRoles: { 'role-authorized': ['role-admin'] },
    }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('denied', { permissions: 'invalid' }),
    oauthGuild('role-authorized', { permissions: 'invalid' }),
  ]);

  assert.deepEqual(result.map(guild => guild.id), ['role-authorized']);
  assert.equal(result[0]?.accessSource, 'admin_role');
});

test('denies a missing member unless owner or Manage Guild is proven', async () => {
  const service = createGuildAccessService(
    createDependencies({ botGuildIds: ['missing', 'owner', 'manager'] }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('missing'),
    oauthGuild('owner', { owner: true }),
    oauthGuild('manager', {
      permissions: PermissionFlagsBits.ManageGuild.toString(),
    }),
  ]);

  assert.deepEqual(
    result.map(guild => [guild.id, guild.accessSource]),
    [
      ['owner', 'owner'],
      ['manager', 'manage_guild'],
    ],
  );
});

test('isolates provider and member fetch failures to the affected guild', async () => {
  const service = createGuildAccessService(
    createDependencies({
      botGuildIds: ['member-failure', 'allowed'],
      failingBotGuildIds: ['bot-failure'],
      failingMemberGuildIds: ['member-failure'],
    }),
  );

  const result = await service.listAuthorizedGuilds([
    oauthGuild('bot-failure', { owner: true }),
    oauthGuild('member-failure'),
    oauthGuild('allowed', { owner: true }),
  ]);

  assert.deepEqual(result.map(guild => guild.id), ['allowed']);
});
