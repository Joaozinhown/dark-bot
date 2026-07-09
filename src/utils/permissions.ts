import {
  PermissionFlagsBits,
  PermissionsBitField,
  GuildMember,
  Role,
} from 'discord.js';
import prisma from '../database/client';

export function hasOrganizationPermission(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export async function getAdminRoleIds(guildId: string): Promise<string[]> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
  });

  if (!config) return [];

  try {
    const roleIds = JSON.parse(config.adminRoleIds);
    return Array.isArray(roleIds) ? roleIds.filter((roleId): roleId is string => typeof roleId === 'string') : [];
  } catch {
    return [];
  }
}

export async function setAdminRoleIds(guildId: string, roleIds: string[]): Promise<void> {
  const uniqueRoleIds = Array.from(new Set(roleIds));

  await prisma.guildConfig.upsert({
    where: { guildId },
    create: {
      guildId,
      adminRoleIds: JSON.stringify(uniqueRoleIds),
    },
    update: {
      adminRoleIds: JSON.stringify(uniqueRoleIds),
    },
  });
}

export async function hasBotAdminPermission(member: GuildMember): Promise<boolean> {
  if (hasOrganizationPermission(member)) return true;

  const roleIds = await getAdminRoleIds(member.guild.id);
  return roleIds.some(roleId => member.roles.cache.has(roleId));
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
