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
}

export interface Command {
  name: string;
  description: string;
}

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
  | 'audit';
