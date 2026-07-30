import { Colors } from 'discord.js';

export interface TeamRole {
  readonly id: string;
  readonly name: string;
}

export interface RoleCreator {
  create(options: {
    name: string;
    colors: { primaryColor: number };
    reason: string;
  }): Promise<TeamRole>;
}

export interface EditableRole {
  readonly name: string;
  setName(name: string): Promise<unknown>;
  delete(reason: string): Promise<unknown>;
}

export interface MemberRoleEditor {
  add(roleId: string): Promise<unknown>;
  remove(roleId: string): Promise<unknown>;
}

export function parseTeamRoleColor(hex: string | null): number | null {
  if (hex === null) return Colors.Default;

  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  return match ? Number.parseInt(match[1], 16) : null;
}

export async function createTeamRole(
  roleCreator: RoleCreator,
  input: Readonly<{
    name: string;
    color: number;
    createdBy: string;
  }>,
): Promise<TeamRole> {
  return roleCreator.create({
    name: input.name,
    colors: { primaryColor: input.color },
    reason: `Cargo de time criado por ${input.createdBy}`,
  });
}

export async function renameTeamRole(
  role: EditableRole,
  newName: string,
): Promise<void> {
  await role.setName(newName);
}

export async function deleteTeamRole(role: EditableRole): Promise<void> {
  await role.delete('Deletado por organizador');
}

export async function addMemberToTeamRole(
  memberRoles: MemberRoleEditor,
  roleId: string,
): Promise<void> {
  await memberRoles.add(roleId);
}

export async function removeMemberFromTeamRole(
  memberRoles: MemberRoleEditor,
  roleId: string,
): Promise<void> {
  await memberRoles.remove(roleId);
}
