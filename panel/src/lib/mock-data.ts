import type {
  ActiveConfrontation,
  AuditEntry,
  Command,
  ConfrontationSummary,
  Guild,
  Health,
  Overview,
  Pool,
  PoolDetail,
  RankingEntry,
  Session,
  Team,
  ManagementData,
  RuntimeLogSnapshot,
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
    name: 'DTA Staff',
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
    timeARoleId: 'team-aurora',
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
  { id: 'team-aurora', name: 'Aurora', color: '#df172c', memberCount: 7, position: 12 },
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
  { nome: 'Aurora', vitorias: 12, derrotas: 3 },
  { nome: 'Legacy Survivors', vitorias: 10, derrotas: 5 },
  { nome: 'Eclipse Gaming', vitorias: 8, derrotas: 6 },
  { nome: 'Void Walkers', vitorias: 6, derrotas: 7 },
  { nome: 'Night Shift', vitorias: 3, derrotas: 9 },
];

function mockNativeCommand(name: string, description: string): Command {
  return {
    id: null,
    stableKey: `native:${name}`,
    sourceType: 'native',
    factoryCommandName: name,
    name,
    description,
    definition: {
      schemaVersion: 1,
      execution: { mode: 'native', factoryCommandName: name },
      command: {
        name: { ptBR: name, enUS: name },
        description: { ptBR: description, enUS: description },
        options: [],
        defaultMemberPermissions: null,
        nsfw: false,
      },
      permissions: { requireBotAdmin: false, allowedRoleIds: [], allowedUserIds: [], cooldownSeconds: 0 },
      workflow: [],
    },
    enabled: true,
    status: 'factory',
    publishedVersionId: null,
    discordCommandId: null,
    hasUnpublishedChanges: false,
    versions: [],
    criadoEm: null,
    atualizadoEm: null,
  };
}

export const mockCommands: Command[] = [
  mockNativeCommand('configurar-bot', 'Configura permissões e parâmetros do bot'),
  mockNativeCommand('criar-confronto', 'Inicia um confronto no canal atual'),
  mockNativeCommand('encerrar', 'Encerra um confronto ativo'),
  mockNativeCommand('gerenciar-cargo', 'Gerencia cargos administrativos'),
  mockNativeCommand('gerenciar-pool', 'Consulta e gerencia pools competitivas'),
  mockNativeCommand('listar-confrontos', 'Lista confrontos recentes e ativos'),
  mockNativeCommand('perfil', 'Mostra o perfil competitivo de um jogador'),
  mockNativeCommand('ranking', 'Mostra a classificação por equipe'),
  mockNativeCommand('relatorios', 'Exibe relatórios do campeonato'),
  mockNativeCommand('resultado', 'Registra o resultado de um set'),
  mockNativeCommand('setup-cargo', 'Cria a estrutura inicial de cargos'),
];

export const mockAudit: AuditEntry[] = [
  {
    id: 38,
    guildId: mockGuilds[0]!.id,
    actorUserId: '329183750129385710',
    actorDisplayName: 'Player One',
    actorUsername: 'player.one',
    action: 'veto.pick',
    entityType: 'confrontation',
    entityId: '185',
    details: {
      actorDisplayName: 'Player One',
      actorUsername: 'player.one',
      channelId: '991830123857102341',
      killer: 'Nurse',
      messageId: '991830123857102349',
      setNumber: 1,
      teamRoleId: 'team-aurora',
      teamRoleName: 'Aurora',
      teamSide: 'A',
      vetoStep: 5,
    },
    criadoEm: isoBefore(12),
  },
  {
    id: 37,
    guildId: mockGuilds[0]!.id,
    actorUserId: '481902374650129384',
    actorDisplayName: 'Rival Captain',
    actorUsername: 'rival.captain',
    action: 'veto.ban',
    entityType: 'confrontation',
    entityId: '185',
    details: {
      actorDisplayName: 'Rival Captain',
      actorUsername: 'rival.captain',
      channelId: '991830123857102341',
      killer: 'Spirit',
      messageId: '991830123857102344',
      setNumber: null,
      teamRoleId: 'team-rift',
      teamRoleName: 'Riftwalkers',
      teamSide: 'B',
      vetoStep: 4,
    },
    criadoEm: isoBefore(18),
  },
  {
    id: 36,
    guildId: mockGuilds[0]!.id,
    actorUserId: mockSession.userId,
    actorDisplayName: 'Matheus',
    actorUsername: 'matheus.dta',
    action: 'confrontation.closed',
    entityType: 'confrontation',
    entityId: '183',
    details: { reason: 'Série concluída', winner: 'Aurora' },
    criadoEm: isoBefore(176),
  },
  {
    id: 35,
    guildId: mockGuilds[0]!.id,
    actorUserId: '329183750129385710',
    actorDisplayName: 'Player One',
    actorUsername: 'player.one',
    action: 'result.recorded',
    entityType: 'set',
    entityId: '183-4',
    details: { winner: 'Aurora', score: '3-1' },
    criadoEm: isoBefore(182),
  },
  {
    id: 34,
    guildId: mockGuilds[0]!.id,
    actorUserId: mockSession.userId,
    actorDisplayName: 'Matheus',
    actorUsername: 'matheus.dta',
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
    actorDisplayName: 'Player One',
    actorUsername: 'player.one',
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

const poolMaps = [
  ["Azarov's Resting Place", 'Shelter Woods', 'Ormond Lake Mine'],
  ['Wretched Shop', 'Midwich Elementary School', 'Suffocation Pit', 'Ironworks of Misery', "Thompson's House"],
  ['Dead Dawg Saloon', 'Coal Tower', 'Treatment Theater', 'Blood Lodge', 'Toba Landing'],
];

export const mockPoolDetails: PoolDetail[] = mockPools.map((pool, poolIndex) => ({
  id: pool.id,
  guildId: mockGuilds[0]!.id,
  nome: pool.nome,
  formato: pool.formato as 'MD3' | 'MD5',
  ativa: pool.ativa,
  mapas: (poolMaps[poolIndex] ?? ['Mapa 1', 'Mapa 2', 'Mapa 3']).map((nome, index) => ({
    id: pool.id * 100 + index,
    poolId: pool.id,
    nome,
    ordem: index + 1,
  })),
  killers: Array.from({ length: pool.killers }, (_, index) => ({
    id: pool.id * 1000 + index,
    poolId: pool.id,
    nome: `Killer ${index + 1}`,
    ordem: index + 1,
  })),
}));

export const mockManagement: ManagementData = {
  adminRoleIds: [mockTeams[0]!.id],
  scriptRoleIds: [mockTeams[0]!.id],
  scriptUserIds: [mockSession.userId],
  roles: mockTeams.map(team => ({ ...team, editable: true })),
  channels: [
    { id: '1352013816543100938', name: 'confronto-01' },
    { id: '1352013816543100939', name: 'confronto-02' },
  ],
  activeConfrontations,
};

export const mockLogs: RuntimeLogSnapshot = {
  source: 'runtime',
  isExactDiscloudSnapshot: false,
  fetchedAt: new Date().toISOString(),
  content: '[DTA] Migrações aplicadas.\n[DTA] Bot online.\n[DTA] 11 comandos sincronizados.\n[DTA] Painel disponível na porta 8080.',
};
