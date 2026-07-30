export type AccessSource = 'owner' | 'manage_guild' | 'admin_role';

export interface Session {
  userId: string;
  username: string;
  avatarHash: string | null;
  expiresAt: string;
  lastAccessAt: string;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  accessSource: AccessSource;
  capabilities: readonly string[];
}

export interface Health {
  status: 'ready' | 'starting';
  botReady: boolean;
  guildCount: number;
  uptimeSeconds: number;
}

export interface ReportSummary {
  totalConfrontos: number;
  confrontosAtivos: number;
  confrontosEncerrados: number;
  jogadores: number;
  poolsAtivas: number;
}

export interface ConfrontationSummary {
  id: number;
  formato: string;
  status: string;
  timeAVitorias: number;
  timeBVitorias: number;
  criadoEm: string;
}

export interface ActiveConfrontation extends ConfrontationSummary {
  guildId: string;
  poolId: number;
  timeARoleId: string;
  timeBRoleId: string;
  currentSet: number;
  channelId: string | null;
  vencedor: 'A' | 'B' | null;
  primeiroKiller: 'A' | 'B' | null;
  encerradoEm: string | null;
  motivoEncerramento: string | null;
}

export interface Pool {
  id: number;
  nome: string;
  formato: string;
  ativa: boolean;
  mapas: number;
  killers: number;
  confrontos: number;
}

export interface Overview {
  summary: ReportSummary;
  confrontations: ActiveConfrontation[];
  pools: Pool[];
}

export interface Team {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  position: number;
  editable?: boolean;
}

export interface Command {
  name: string;
  description: string;
  enabled?: boolean;
}

export interface PoolItem {
  id: number;
  poolId: number;
  nome: string;
  ordem: number;
}

export interface PoolDetail {
  id: number;
  guildId: string;
  nome: string;
  formato: 'MD3' | 'MD5';
  ativa: boolean;
  mapas: PoolItem[];
  killers: PoolItem[];
}

export interface ManagementData {
  adminRoleIds: string[];
  roles: Array<Team & { editable: boolean }>;
  channels: Array<{ id: string; name: string }>;
  activeConfrontations: ActiveConfrontation[];
}

export type PanelAction =
  | { type: 'pool.create'; name: string; format: 'MD3' | 'MD5' }
  | { type: 'pool.add-map' | 'pool.remove-map' | 'pool.add-killer' | 'pool.remove-killer'; poolId: number; name: string }
  | { type: 'pool.toggle' | 'pool.delete'; poolId: number }
  | { type: 'team.create'; name: string; color: string }
  | { type: 'team.rename'; roleId: string; name: string }
  | { type: 'team.delete'; roleId: string }
  | { type: 'team.member-add' | 'team.member-remove'; roleId: string; userId: string }
  | { type: 'permission.set-admin-roles'; roleIds: string[] }
  | { type: 'command.set-enabled'; commandName: string; enabled: boolean }
  | { type: 'confrontation.create'; poolId: number; teamARoleId: string; teamBRoleId: string; channelId: string }
  | { type: 'confrontation.result'; confrontationId: number; winnerRoleId: string }
  | { type: 'confrontation.close'; confrontationId: number; reason: string | null };

export interface RankingEntry {
  nome: string;
  vitorias: number;
  derrotas: number;
}

export interface AuditEntry {
  id: number;
  guildId: string;
  actorUserId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Readonly<Record<string, unknown>>;
  criadoEm: string;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
export type GuildResource =
  | 'overview'
  | 'confrontations'
  | 'pools'
  | 'teams'
  | 'commands'
  | 'ranking'
  | 'audit'
  | 'pool-details'
  | 'management';
