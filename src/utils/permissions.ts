import {
  PermissionFlagsBits,
  PermissionsBitField,
  GuildMember,
  Role,
} from 'discord.js';

export function hasOrganizationPermission(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function hasCaptainPermission(member: GuildMember, teamRoleId: string): boolean {
  return member.roles.cache.has(teamRoleId);
}

export function hasPlayerPermission(member: GuildMember, teamRoleId: string): boolean {
  return member.roles.cache.has(teamRoleId);
}

export function canAccessChannel(member: GuildMember, allowedRoleIds: string[]): boolean {
  return allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
}

export function parseHexColor(hex: string): number | null {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);

  if (isNaN(num) || num < 0 || num > 0xFFFFFF) {
    return null;
  }

  return num;
}
