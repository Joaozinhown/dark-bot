"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guildPermissionService = void 0;
exports.hasOrganizationPermission = hasOrganizationPermission;
exports.getAdminRoleIds = getAdminRoleIds;
exports.setAdminRoleIds = setAdminRoleIds;
exports.hasBotAdminPermission = hasBotAdminPermission;
exports.hasCaptainPermission = hasCaptainPermission;
exports.hasPlayerPermission = hasPlayerPermission;
exports.canAccessChannel = canAccessChannel;
exports.parseHexColor = parseHexColor;
const discord_js_1 = require("discord.js");
const client_1 = __importDefault(require("../database/client"));
const guild_permission_service_1 = require("../services/guild-permission-service");
const guildPermissionStore = {
    async getAdminRoleIds(guildId) {
        const config = await client_1.default.guildConfig.findUnique({
            where: { guildId },
            select: { adminRoleIds: true },
        });
        return config?.adminRoleIds ?? null;
    },
    async setAdminRoleIds(guildId, adminRoleIds) {
        await client_1.default.guildConfig.upsert({
            where: { guildId },
            create: { guildId, adminRoleIds },
            update: { adminRoleIds },
        });
    },
};
exports.guildPermissionService = (0, guild_permission_service_1.createGuildPermissionService)(guildPermissionStore);
function hasOrganizationPermission(member) {
    return member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild);
}
async function getAdminRoleIds(guildId) {
    return exports.guildPermissionService.listAdminRoleIds(guildId);
}
async function setAdminRoleIds(guildId, roleIds) {
    await exports.guildPermissionService.setAdminRoleIds(guildId, roleIds);
}
async function hasBotAdminPermission(member) {
    return exports.guildPermissionService.hasBotAdminPermission({
        guildId: member.guild.id,
        hasManageGuild: hasOrganizationPermission(member),
        roleIds: Array.from(member.roles.cache.keys()),
    });
}
function hasCaptainPermission(member, teamRoleId) {
    return member.roles.cache.has(teamRoleId);
}
function hasPlayerPermission(member, teamRoleId) {
    return member.roles.cache.has(teamRoleId);
}
function canAccessChannel(member, allowedRoleIds) {
    return allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
}
function parseHexColor(hex) {
    const cleaned = hex.replace('#', '');
    const num = parseInt(cleaned, 16);
    if (isNaN(num) || num < 0 || num > 0xFFFFFF) {
        return null;
    }
    return num;
}
//# sourceMappingURL=permissions.js.map