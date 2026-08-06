"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const discord_js_1 = require("discord.js");
const guild_access_1 = require("./guild-access");
function oauthGuild(id, overrides = {}) {
    return {
        id,
        name: `Guild ${id}`,
        icon: null,
        owner: false,
        permissions: '0',
        ...overrides,
    };
}
function createDependencies(options = {}) {
    const botGuildIds = new Set(options.botGuildIds ?? []);
    const failingBotGuildIds = new Set(options.failingBotGuildIds ?? []);
    const failingMemberGuildIds = new Set(options.failingMemberGuildIds ?? []);
    const guildPermissionService = {
        listAdminRoleIds: async (guildId) => [
            ...(options.configuredRoles?.[guildId] ?? []),
        ],
        setAdminRoleIds: async () => undefined,
        addAdminRole: async () => [],
        removeAdminRole: async () => [],
        hasBotAdminPermission: async (subject) => {
            const configuredRoleIds = new Set(options.configuredRoles?.[subject.guildId] ?? []);
            return subject.roleIds.some(roleId => configuredRoleIds.has(roleId));
        },
    };
    return {
        botGuildProvider: {
            async hasGuild(guildId) {
                if (failingBotGuildIds.has(guildId))
                    throw new Error('fetch failed');
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
(0, node_test_1.default)('returns only OAuth guilds where the bot is connected', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({ botGuildIds: ['shared', 'bot-only'] }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('shared', { owner: true }),
        oauthGuild('oauth-only', { owner: true }),
    ]);
    strict_1.default.deepEqual(result.map(guild => guild.id), ['shared']);
});
(0, node_test_1.default)('authorizes a guild owner with bot management capability', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({ botGuildIds: ['guild-a'] }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('guild-a', { owner: true }),
    ]);
    strict_1.default.deepEqual(result, [
        {
            id: 'guild-a',
            name: 'Guild guild-a',
            icon: null,
            accessSource: 'owner',
            capabilities: ['manage_bot'],
        },
    ]);
});
(0, node_test_1.default)('authorizes Manage Guild permission from the OAuth bitfield', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({ botGuildIds: ['guild-a'] }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('guild-a', {
            permissions: discord_js_1.PermissionFlagsBits.ManageGuild.toString(),
        }),
    ]);
    strict_1.default.equal(result[0]?.accessSource, 'manage_guild');
});
(0, node_test_1.default)('authorizes a configured admin role resolved for the same guild', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({
        botGuildIds: ['guild-a'],
        memberRoles: { 'guild-a': ['role-admin'] },
        configuredRoles: { 'guild-a': ['role-admin'] },
    }));
    const result = await service.listAuthorizedGuilds([oauthGuild('guild-a')]);
    strict_1.default.equal(result[0]?.accessSource, 'admin_role');
});
(0, node_test_1.default)('does not reuse a member role configured in another guild', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({
        botGuildIds: ['guild-a', 'guild-b'],
        memberRoles: {
            'guild-a': ['role-b'],
            'guild-b': ['role-b'],
        },
        configuredRoles: {
            'guild-a': ['role-a'],
            'guild-b': ['role-b'],
        },
    }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('guild-a'),
        oauthGuild('guild-b'),
    ]);
    strict_1.default.deepEqual(result.map(guild => guild.id), ['guild-b']);
});
(0, node_test_1.default)('denies malformed permissions unless a configured role is proven', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({
        botGuildIds: ['denied', 'role-authorized'],
        memberRoles: {
            denied: [],
            'role-authorized': ['role-admin'],
        },
        configuredRoles: { 'role-authorized': ['role-admin'] },
    }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('denied', { permissions: 'invalid' }),
        oauthGuild('role-authorized', { permissions: 'invalid' }),
    ]);
    strict_1.default.deepEqual(result.map(guild => guild.id), ['role-authorized']);
    strict_1.default.equal(result[0]?.accessSource, 'admin_role');
});
(0, node_test_1.default)('denies a missing member unless owner or Manage Guild is proven', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({ botGuildIds: ['missing', 'owner', 'manager'] }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('missing'),
        oauthGuild('owner', { owner: true }),
        oauthGuild('manager', {
            permissions: discord_js_1.PermissionFlagsBits.ManageGuild.toString(),
        }),
    ]);
    strict_1.default.deepEqual(result.map(guild => [guild.id, guild.accessSource]), [
        ['owner', 'owner'],
        ['manager', 'manage_guild'],
    ]);
});
(0, node_test_1.default)('isolates provider and member fetch failures to the affected guild', async () => {
    const service = (0, guild_access_1.createGuildAccessService)(createDependencies({
        botGuildIds: ['member-failure', 'allowed'],
        failingBotGuildIds: ['bot-failure'],
        failingMemberGuildIds: ['member-failure'],
    }));
    const result = await service.listAuthorizedGuilds([
        oauthGuild('bot-failure', { owner: true }),
        oauthGuild('member-failure'),
        oauthGuild('allowed', { owner: true }),
    ]);
    strict_1.default.deepEqual(result.map(guild => guild.id), ['allowed']);
});
//# sourceMappingURL=guild-access.test.js.map