"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuildAccessService = createGuildAccessService;
const discord_js_1 = require("discord.js");
const MANAGE_BOT_CAPABILITIES = ['manage_bot'];
function hasManageGuildPermission(permissions) {
    try {
        return new discord_js_1.PermissionsBitField(BigInt(permissions)).has(discord_js_1.PermissionFlagsBits.ManageGuild);
    }
    catch {
        return false;
    }
}
function toAuthorizedGuild(guild, accessSource) {
    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        accessSource,
        capabilities: MANAGE_BOT_CAPABILITIES,
    };
}
function createGuildAccessService(dependencies) {
    async function authorizeGuild(guild) {
        try {
            if (!(await dependencies.botGuildProvider.hasGuild(guild.id)))
                return null;
            if (guild.owner)
                return toAuthorizedGuild(guild, 'owner');
            if (hasManageGuildPermission(guild.permissions)) {
                return toAuthorizedGuild(guild, 'manage_guild');
            }
            const roleIds = await dependencies.memberRoleResolver.resolveRoleIds(guild.id);
            if (roleIds === null)
                return null;
            const hasConfiguredRole = await dependencies.guildPermissionService.hasBotAdminPermission({
                guildId: guild.id,
                hasManageGuild: false,
                roleIds,
            });
            return hasConfiguredRole
                ? toAuthorizedGuild(guild, 'admin_role')
                : null;
        }
        catch {
            return null;
        }
    }
    async function listAuthorizedGuilds(oauthGuilds) {
        const authorizationResults = await Promise.all(oauthGuilds.map(authorizeGuild));
        return authorizationResults.filter((guild) => guild !== null);
    }
    return { listAuthorizedGuilds };
}
//# sourceMappingURL=guild-access.js.map