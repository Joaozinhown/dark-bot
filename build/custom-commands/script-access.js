"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptAccessService = void 0;
const client_1 = __importDefault(require("../database/client"));
function normalizeIds(values) {
    return [...new Set(values.filter((value) => typeof value === 'string' && /^\d{16,22}$/.test(value)))];
}
function parseIds(value) {
    try {
        const parsed = JSON.parse(value ?? '[]');
        return Array.isArray(parsed) ? normalizeIds(parsed) : [];
    }
    catch {
        return [];
    }
}
exports.scriptAccessService = {
    async get(guildId) {
        const config = await client_1.default.guildConfig.findUnique({ where: { guildId } });
        return {
            roleIds: parseIds(config?.scriptRoleIds),
            userIds: parseIds(config?.scriptUserIds),
            updatedByUserId: config?.scriptAccessById ?? null,
        };
    },
    async set(guildId, roleIds, userIds, updatedByUserId) {
        const normalizedRoles = normalizeIds(roleIds);
        const normalizedUsers = normalizeIds(userIds);
        await client_1.default.guildConfig.upsert({
            where: { guildId },
            create: {
                guildId,
                scriptRoleIds: JSON.stringify(normalizedRoles),
                scriptUserIds: JSON.stringify(normalizedUsers),
                scriptAccessById: updatedByUserId,
            },
            update: {
                scriptRoleIds: JSON.stringify(normalizedRoles),
                scriptUserIds: JSON.stringify(normalizedUsers),
                scriptAccessById: updatedByUserId,
            },
        });
        return { roleIds: normalizedRoles, userIds: normalizedUsers, updatedByUserId };
    },
    async canUseScripts(subject) {
        if (subject.isGuildOwner || subject.hasManageGuild)
            return true;
        const config = await this.get(subject.guildId);
        if (config.userIds.includes(subject.userId))
            return true;
        const memberRoles = new Set(subject.roleIds);
        return config.roleIds.some(roleId => memberRoles.has(roleId));
    },
    canManageConfig(subject) {
        return subject.isGuildOwner || subject.hasManageGuild;
    },
};
//# sourceMappingURL=script-access.js.map