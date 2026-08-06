"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuildPermissionService = createGuildPermissionService;
function normalizeRoleIds(roleIds) {
    return Array.from(new Set(roleIds.filter((roleId) => typeof roleId === 'string' && roleId.length > 0)));
}
function parseRoleIds(value) {
    if (value === null)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? normalizeRoleIds(parsed) : [];
    }
    catch {
        return [];
    }
}
function createGuildPermissionService(store) {
    async function listAdminRoleIds(guildId) {
        return parseRoleIds(await store.getAdminRoleIds(guildId));
    }
    async function setAdminRoleIds(guildId, roleIds) {
        await store.setAdminRoleIds(guildId, JSON.stringify(normalizeRoleIds(roleIds)));
    }
    async function addAdminRole(guildId, roleId) {
        const roleIds = normalizeRoleIds([
            ...(await listAdminRoleIds(guildId)),
            roleId,
        ]);
        await setAdminRoleIds(guildId, roleIds);
        return roleIds;
    }
    async function removeAdminRole(guildId, roleId) {
        const roleIds = (await listAdminRoleIds(guildId)).filter(currentRoleId => currentRoleId !== roleId);
        await setAdminRoleIds(guildId, roleIds);
        return roleIds;
    }
    async function hasBotAdminPermission(subject) {
        if (subject.hasManageGuild)
            return true;
        const adminRoleIds = await listAdminRoleIds(subject.guildId);
        const memberRoleIds = new Set(subject.roleIds);
        return adminRoleIds.some(roleId => memberRoleIds.has(roleId));
    }
    return {
        listAdminRoleIds,
        setAdminRoleIds,
        addAdminRole,
        removeAdminRole,
        hasBotAdminPermission,
    };
}
//# sourceMappingURL=guild-permission-service.js.map