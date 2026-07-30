import {
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import prisma from '../database/client';
import {
  createGuildPermissionService,
  type GuildPermissionStore,
} from '../services/guild-permission-service';

const guildPermissionStore: GuildPermissionStore = {
  async getAdminRoleIds(guildId) {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { adminRoleIds: true },
    });

    return config?.adminRoleIds ?? null;
  },
  async setAdminRoleIds(guildId, adminRoleIds) {
    await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, adminRoleIds },
      update: { adminRoleIds },
    });
  },
};

export const guildPermissionService =
  createGuildPermissionService(guildPermissionStore);

export function hasOrganizationPermission(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export async function getAdminRoleIds(guildId: string): Promise<string[]> {
  return guildPermissionService.listAdminRoleIds(guildId);
}

export async function setAdminRoleIds(guildId: string, roleIds: string[]): Promise<void> {
  await guildPermissionService.setAdminRoleIds(guildId, roleIds);
}

export async function hasBotAdminPermission(member: GuildMember): Promise<boolean> {
  return guildPermissionService.hasBotAdminPermission({
    guildId: member.guild.id,
    hasManageGuild: hasOrganizationPermission(member),
    roleIds: Array.from(member.roles.cache.keys()),
  });
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
