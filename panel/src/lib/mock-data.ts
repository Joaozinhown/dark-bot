import type {
  ActiveConfrontation,
  AuditEntry,
  Command,
  ConfrontationSummary,
  Guild,
  Health,
  Overview,
  Pool,
  RankingEntry,
  Session,
  Team,
} from '../types/api';

const now = Date.now();
const isoBefore = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

export const mockSession: Session = {
  userId: '184937201458937201',
  username: 'matheus.dta',
  avatarHash: null,
  expiresAt: new Date(now + 7 * 86_400_000).toISOString(),
  lastAccessAt: new Date(now).toISOString(),
};

export const mockGuilds: Guild[] = [
  {
    id: '1183511029329154098',
    name: 'Dark Trials Arena',
    icon: null,
    accessSource: 'owner',
    capabilities: ['manage_bot'],
  },
  {
    id: '1248523813054197918',
    name: 'Queens Trials Staff',
    icon: null,
    accessSource: 'admin_role',
    capabilities: ['manage_bot'],
  },
];

export const mockHealth: Health = {
  status: 'ready',
  botReady: true,
  guildCount: 12,
  uptimeSeconds: 148_860,
};

const activeConfrontations: ActiveConfrontation[] = [
  {
    id: 184,
    guildId: mockGuilds[0]!.id,
    poolId: 3,
    formato: 'MD5',
    status: 'veto',
    timeARoleId: 'team-queens',
    timeBRoleId: 'team-eclipse',
    timeAVitorias: 1,
    timeBVitorias: 1,
    currentSet: 3,
    channelId: '1352013816543100938',
    vencedor: null,
    primeiroKiller: 'B',
    encerradoEm: null,
    motivoEncerramento: null,
    criadoEm: isoBefore(34),
  },
  {
    id: 185,
    guildId: mockGuilds[0]!.id,
    poolId: 1,
    formato: 'MD3',
    status: 'resultado',
    timeARoleId: 'team-legacy',
    timeBRoleId: 'team-void',
    timeAVitorias: 1,
    timeBVitorias: 0,
    currentSet: 2,
    channelId: '1352013816543100939',
    vencedor: 'A',
    primeiroKiller: 'A',
    encerradoEm: null,
    motivoEncerramento: null,
    criadoEm: isoBefore(18),
  },
];

export const mockPools: Pool[] = [
  { id: 1, nome: 'Pool 1', formato: 'MD3', ativa: true, mapas: 3, killers: 9, confrontos: 42 },
  { id: 2, nome: 'Pool 2', formato: 'MD5', ativa: true, mapas: 5, killers: 11, confrontos: 18 },
  { id: 3, nome: 'Pool 3', formato: 'MD5', ativa: true, mapas: 5, killers: 11, confrontos: 27 },
  { id: 4, nome: 'Pool treino', formato: 'MD3', ativa: false, mapas: 3, killers: 8, confrontos: 6 },
];

export const mockTeams: Team[] = [
  { id: 'team-queens', name: 'Queens of the Fog', color: '#8f32d9', memberCount: 7, position: 12 },
  { id: 'team-eclipse', name: 'Eclipse Gaming', color: '#dc143c', memberCount: 6, position: 11 },
  { id: 'team-legacy', name: 'Legacy Survivors', color: '#c9a227', memberCount: 8, position: 10 },
  { id: 'team-void', name: 'Void Walkers', color: '#2ecc71', memberCount: 5, position: 9 },
  { id: 'team-night', name: 'Night Shift', color: '#3498db', memberCount: 6, position: 8 },
];

export const mockRecentConfrontations: ConfrontationSummary[] = [
  ...activeConfrontations,
  { id: 183, formato: 'MD5', status: 'encerrado', timeAVitorias: 3, timeBVitorias: 1, criadoEm: isoBefore(180) },
  { id: 182, formato: 'MD3', status: 'encerrado', timeAVitorias: 1, timeBVitorias: 2, criadoEm: isoBefore(310) },
  { id: 181, formato: 'MD3', status: 'encerrado', timeAVitorias: 2, timeBVitorias: 0, criadoEm: isoBefore(1_440) },
  { id: 180, formato: 'MD5', status: 'encerrado', timeAVitorias: 2, timeBVitorias: 3, criadoEm: isoBefore(1_920) },
];

export const mockRanking: RankingEntry[] = [
  { nome: 'Queens of the Fog', vitorias: 12, derrotas: 3 },
  { nome: 'Legacy Survivors', vitorias: 10, derrotas: 5 },
  { nome: 'Eclipse Gaming', vitorias: 8, derrotas: 6 },
  { nome: 'Void Walkers', vitorias: 6, derrotas: 7 },
  { nome: 'Night Shift', vitorias: 3, derrotas: 9 },
];

export const mockCommands: Command[] = [
  { name: 'configurar-bot', description: 'Configura permissões e parâmetros do bot' },
  { name: 'criar-confronto', description: 'Inicia um confronto no canal atual' },
  { name: 'encerrar', description: 'Encerra um confronto ativo' },
  { name: 'gerenciar-cargo', description: 'Gerencia cargos administrativos' },
  { name: 'gerenciar-pool', description: 'Consulta e gerencia pools competitivas' },
  { name: 'listar-confrontos', description: 'Lista confrontos recentes e ativos' },
  { name: 'perfil', description: 'Mostra o perfil competitivo de um jogador' },
  { name: 'ranking', description: 'Mostra a classificação por equipe' },
  { name: 'relatorios', description: 'Exibe relatórios do campeonato' },
  { name: 'resultado', description: 'Registra o resultado de um set' },
  { name: 'setup-cargo', description: 'Cria a estrutura inicial de cargos' },
];

export const mockAudit: AuditEntry[] = [
  {
    id: 36,
    guildId: mockGuilds[0]!.id,
    actorUserId: mockSession.userId,
    action: 'confrontation.closed',
    entityType: 'confrontation',
    entityId: '183',
    details: { reason: 'Série concluída', winner: 'Queens of the Fog' },
    criadoEm: isoBefore(176),
  },
  {
    id: 35,
    guildId: mockGuilds[0]!.id,
    actorUserId: '329183750129385710',
    action: 'result.recorded',
    entityType: 'set',
    entityId: '183-4',
    details: { winner: 'Queens of the Fog', score: '3-1' },
    criadoEm: isoBefore(182),
  },
  {
    id: 34,
    guildId: mockGuilds[0]!.id,
    actorUserId: mockSession.userId,
    action: 'pool.activated',
    entityType: 'pool',
    entityId: '3',
    details: { name: 'Pool 3', format: 'MD5' },
    criadoEm: isoBefore(480),
  },
  {
    id: 33,
    guildId: mockGuilds[0]!.id,
    actorUserId: '329183750129385710',
    action: 'role.permission.granted',
    entityType: 'role',
    entityId: 'staff-role',
    details: { role: '@Organização' },
    criadoEm: isoBefore(1_430),
  },
];

export const mockOverview: Overview = {
  summary: {
    totalConfrontos: 185,
    confrontosAtivos: activeConfrontations.length,
    confrontosEncerrados: 183,
    jogadores: 84,
    poolsAtivas: 3,
  },
  confrontations: activeConfrontations,
  pools: mockPools,
};
