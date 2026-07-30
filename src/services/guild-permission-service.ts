export interface GuildPermissionStore {
  getAdminRoleIds(guildId: string): Promise<string | null>;
  setAdminRoleIds(guildId: string, adminRoleIds: string): Promise<void>;
}

export interface GuildPermissionSubject {
  readonly guildId: string;
  readonly hasManageGuild: boolean;
  readonly roleIds: readonly string[];
}

export interface GuildPermissionService {
  listAdminRoleIds(guildId: string): Promise<string[]>;
  setAdminRoleIds(guildId: string, roleIds: readonly string[]): Promise<void>;
  addAdminRole(guildId: string, roleId: string): Promise<string[]>;
  removeAdminRole(guildId: string, roleId: string): Promise<string[]>;
  hasBotAdminPermission(subject: GuildPermissionSubject): Promise<boolean>;
}

function normalizeRoleIds(roleIds: readonly unknown[]): string[] {
  return Array.from(
    new Set(
      roleIds.filter(
        (roleId): roleId is string =>
          typeof roleId === 'string' && roleId.length > 0,
      ),
    ),
  );
}

function parseRoleIds(value: string | null): string[] {
  if (value === null) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeRoleIds(parsed) : [];
  } catch {
    return [];
  }
}

export function createGuildPermissionService(
  store: GuildPermissionStore,
): GuildPermissionService {
  async function listAdminRoleIds(guildId: string): Promise<string[]> {
    return parseRoleIds(await store.getAdminRoleIds(guildId));
  }

  async function setAdminRoleIds(
    guildId: string,
    roleIds: readonly string[],
  ): Promise<void> {
    await store.setAdminRoleIds(guildId, JSON.stringify(normalizeRoleIds(roleIds)));
  }

  async function addAdminRole(
    guildId: string,
    roleId: string,
  ): Promise<string[]> {
    const roleIds = normalizeRoleIds([
      ...(await listAdminRoleIds(guildId)),
      roleId,
    ]);
    await setAdminRoleIds(guildId, roleIds);
    return roleIds;
  }

  async function removeAdminRole(
    guildId: string,
    roleId: string,
  ): Promise<string[]> {
    const roleIds = (await listAdminRoleIds(guildId)).filter(
      currentRoleId => currentRoleId !== roleId,
    );
    await setAdminRoleIds(guildId, roleIds);
    return roleIds;
  }

  async function hasBotAdminPermission(
    subject: GuildPermissionSubject,
  ): Promise<boolean> {
    if (subject.hasManageGuild) return true;

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
