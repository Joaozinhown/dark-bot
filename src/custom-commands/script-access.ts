import prisma from '../database/client';

export interface ScriptAccessSubject {
  readonly guildId: string;
  readonly userId: string;
  readonly roleIds: readonly string[];
  readonly isGuildOwner: boolean;
  readonly hasManageGuild: boolean;
}

export interface ScriptAccessConfig {
  readonly roleIds: string[];
  readonly userIds: string[];
  readonly updatedByUserId: string | null;
}

function normalizeIds(values: readonly unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && /^\d{16,22}$/.test(value)))];
}

function parseIds(value: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? normalizeIds(parsed) : [];
  } catch {
    return [];
  }
}

export const scriptAccessService = {
  async get(guildId: string): Promise<ScriptAccessConfig> {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    return {
      roleIds: parseIds(config?.scriptRoleIds),
      userIds: parseIds(config?.scriptUserIds),
      updatedByUserId: config?.scriptAccessById ?? null,
    };
  },

  async set(
    guildId: string,
    roleIds: readonly string[],
    userIds: readonly string[],
    updatedByUserId: string,
  ): Promise<ScriptAccessConfig> {
    const normalizedRoles = normalizeIds(roleIds);
    const normalizedUsers = normalizeIds(userIds);
    await prisma.guildConfig.upsert({
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

  async canUseScripts(subject: ScriptAccessSubject): Promise<boolean> {
    if (subject.isGuildOwner || subject.hasManageGuild) return true;
    const config = await this.get(subject.guildId);
    if (config.userIds.includes(subject.userId)) return true;
    const memberRoles = new Set(subject.roleIds);
    return config.roleIds.some(roleId => memberRoles.has(roleId));
  },

  canManageConfig(subject: ScriptAccessSubject): boolean {
    return subject.isGuildOwner || subject.hasManageGuild;
  },
};
