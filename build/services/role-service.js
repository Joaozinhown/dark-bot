"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTeamRoleColor = parseTeamRoleColor;
exports.createTeamRole = createTeamRole;
exports.renameTeamRole = renameTeamRole;
exports.deleteTeamRole = deleteTeamRole;
exports.addMemberToTeamRole = addMemberToTeamRole;
exports.removeMemberFromTeamRole = removeMemberFromTeamRole;
const discord_js_1 = require("discord.js");
function parseTeamRoleColor(hex) {
    if (hex === null)
        return discord_js_1.Colors.Default;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex);
    return match ? Number.parseInt(match[1], 16) : null;
}
async function createTeamRole(roleCreator, input) {
    return roleCreator.create({
        name: input.name,
        colors: { primaryColor: input.color },
        reason: `Cargo de time criado por ${input.createdBy}`,
    });
}
async function renameTeamRole(role, newName) {
    await role.setName(newName);
}
async function deleteTeamRole(role) {
    await role.delete('Deletado por organizador');
}
async function addMemberToTeamRole(memberRoles, roleId) {
    await memberRoles.add(roleId);
}
async function removeMemberFromTeamRole(memberRoles, roleId) {
    await memberRoles.remove(roleId);
}
//# sourceMappingURL=role-service.js.map