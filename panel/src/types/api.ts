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
  id: number | null;
  stableKey: string;
  sourceType: 'native' | 'custom';
  factoryCommandName: string | null;
  name: string;
  description: string;
  definition: CustomCommandDefinition;
  enabled: boolean;
  status: string;
  publishedVersionId: number | null;
  discordCommandId: string | null;
  hasUnpublishedChanges: boolean;
  versions: CommandVersion[];
  criadoEm: string | null;
  atualizadoEm: string | null;
}

export interface LocalizedText {
  ptBR: string;
  enUS: string;
}

export interface CommandVersion {
  id: number;
  version: number;
  definition: CustomCommandDefinition;
  publishedById: string;
  criadoEm: string;
}

export interface CustomCommandDefinition {
  schemaVersion: 1;
  execution: { mode: 'native' | 'workflow'; factoryCommandName?: string };
  command: {
    name: LocalizedText;
    description: LocalizedText;
    options: CommandOption[];
    defaultMemberPermissions: string | null;
    nsfw: boolean;
  };
  permissions: {
    requireBotAdmin: boolean;
    allowedRoleIds: string[];
    allowedUserIds: string[];
    cooldownSeconds: number;
  };
  workflow: WorkflowStep[];
}

export type CommandOption =
  | {
    kind: 'parameter'; id: string; key: string;
    type: 'string' | 'integer' | 'number' | 'boolean' | 'user' | 'channel' | 'role' | 'mentionable' | 'attachment';
    name: LocalizedText; description: LocalizedText; required: boolean;
    choices?: Array<{ name: LocalizedText; value: string | number }>;
    minValue?: number; maxValue?: number; minLength?: number; maxLength?: number;
  }
  | { kind: 'subcommand'; id: string; key: string; name: LocalizedText; description: LocalizedText; options: Extract<CommandOption, { kind: 'parameter' }>[] }
  | { kind: 'subcommand_group'; id: string; key: string; name: LocalizedText; description: LocalizedText; options: Extract<CommandOption, { kind: 'subcommand' }>[] };

export interface MessageTemplate {
  content?: LocalizedText;
  ephemeral: boolean;
  embeds: Array<{
    title?: LocalizedText;
    description?: LocalizedText;
    color?: string;
    footer?: LocalizedText;
    fields: Array<{ id: string; name: LocalizedText; value: LocalizedText; inline: boolean }>;
  }>;
  components: InteractiveComponent[];
}

export type InteractiveComponent =
  | { kind: 'button'; id: string; label: LocalizedText; style: 'primary' | 'secondary' | 'success' | 'danger'; expiresInSeconds: number; restrictToInvoker: boolean; workflow: WorkflowStep[] }
  | { kind: 'select'; id: string; placeholder: LocalizedText; minValues: number; maxValues: number; expiresInSeconds: number; restrictToInvoker: boolean; options: Array<{ id: string; label: LocalizedText; description?: LocalizedText; value: string }>; workflow: WorkflowStep[] }
  | { kind: 'modal'; id: string; label: LocalizedText; style: 'primary' | 'secondary' | 'success' | 'danger'; title: LocalizedText; expiresInSeconds: number; restrictToInvoker: boolean; fields: Array<{ id: string; label: LocalizedText; style: 'short' | 'paragraph'; required: boolean; placeholder?: LocalizedText; minLength?: number; maxLength?: number }>; workflow: WorkflowStep[] };

export type WorkflowStep =
  | { id: string; type: 'reply' | 'followup'; message: MessageTemplate }
  | { id: string; type: 'send_message'; channelId: string; message: MessageTemplate }
  | { id: string; type: 'add_role' | 'remove_role'; userId: string; roleId: string }
  | { id: string; type: 'set_variable'; name: string; value: string }
  | { id: string; type: 'condition'; left: string; operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'exists'; right?: string; whenTrue: WorkflowStep[]; whenFalse: WorkflowStep[] }
  | { id: string; type: 'random'; branches: Array<{ id: string; weight: number; workflow: WorkflowStep[] }> }
  | { id: string; type: 'delay'; milliseconds: number }
  | { id: string; type: 'script'; code: string };

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
  scriptRoleIds: string[];
  scriptUserIds: string[];
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
  | { type: 'permission.set-script-access'; roleIds: string[]; userIds: string[] }
  | { type: 'command.set-enabled'; commandName: string; enabled: boolean }
  | { type: 'command.save-draft'; commandId: number | null; sourceType: 'native' | 'custom'; factoryCommandName: string | null; definition: CustomCommandDefinition }
  | { type: 'command.publish'; commandId: number }
  | { type: 'command.rollback'; commandId: number; versionId: number }
  | { type: 'command.archive'; commandId: number }
  | { type: 'command.clone'; commandId: number; targetGuildId: string; name: LocalizedText }
  | { type: 'command.set-dynamic-enabled'; commandId: number; enabled: boolean }
  | { type: 'command.preview'; definition: CustomCommandDefinition; simulation?: { locale?: 'pt-BR' | 'en-US'; options?: Record<string, unknown> } }
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
  actorDisplayName: string;
  actorUsername: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Readonly<Record<string, unknown>>;
  criadoEm: string;
}

export interface RuntimeLogSnapshot {
  source: 'discloud' | 'runtime';
  content: string;
  fetchedAt: string;
  isExactDiscloudSnapshot: boolean;
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
  | 'management'
  | 'logs';
