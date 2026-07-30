import {
  mockAudit,
  mockCommands,
  mockGuilds,
  mockHealth,
  mockOverview,
  mockPoolDetails,
  mockManagement,
  mockPools,
  mockRanking,
  mockRecentConfrontations,
  mockSession,
  mockTeams,
} from './mock-data';
import type {
  ApiEnvelope,
  AuditEntry,
  Command,
  ConfrontationSummary,
  Guild,
  Health,
  Overview,
  PanelAction,
  Pool,
  PoolDetail,
  RankingEntry,
  Session,
  Team,
  ManagementData,
} from '../types/api';

export const isMockMode = import.meta.env.DEV && import.meta.env.VITE_PANEL_MOCK === 'true';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split('; ').find(item => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!isEnvelope<T>(payload)) {
    throw new ApiError('A API retornou uma resposta inválida.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || !payload.success) {
    const failure = payload.success ? null : payload.error;
    throw new ApiError(
      failure?.message ?? 'Não foi possível concluir a solicitação.',
      response.status,
      failure?.code ?? 'REQUEST_FAILED',
    );
  }
  return payload.data;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

let mockAuthenticated = new URLSearchParams(window.location.search).get('mockAuth') !== 'logged-out';

async function mockDelay<T>(value: T): Promise<T> {
  await new Promise(resolve => window.setTimeout(resolve, 120));
  return clone(value);
}

export const panelApi = {
  health(): Promise<Health> {
    return isMockMode ? mockDelay(mockHealth) : request('/health');
  },

  session(): Promise<Session> {
    if (isMockMode) {
      return mockAuthenticated
        ? mockDelay(mockSession)
        : Promise.reject(new ApiError('Autenticação necessária.', 401, 'UNAUTHENTICATED'));
    }
    return request('/api/auth/session');
  },

  guilds(): Promise<Guild[]> {
    return isMockMode ? mockDelay(mockGuilds) : request('/api/guilds');
  },

  overview(guildId: string): Promise<Overview> {
    return isMockMode ? mockDelay(mockOverview) : request(`/api/guilds/${guildId}/overview`);
  },

  confrontations(guildId: string): Promise<ConfrontationSummary[]> {
    return isMockMode
      ? mockDelay(mockRecentConfrontations)
      : request(`/api/guilds/${guildId}/confrontations`);
  },

  pools(guildId: string): Promise<Pool[]> {
    return isMockMode ? mockDelay(mockPools) : request(`/api/guilds/${guildId}/pools`);
  },

  teams(guildId: string): Promise<Team[]> {
    return isMockMode ? mockDelay(mockTeams) : request(`/api/guilds/${guildId}/teams`);
  },

  commands(guildId: string): Promise<Command[]> {
    return isMockMode ? mockDelay(mockCommands) : request(`/api/guilds/${guildId}/commands`);
  },

  poolDetails(guildId: string): Promise<PoolDetail[]> {
    return isMockMode ? mockDelay(mockPoolDetails) : request(`/api/guilds/${guildId}/pool-details`);
  },

  management(guildId: string): Promise<ManagementData> {
    return isMockMode ? mockDelay(mockManagement) : request(`/api/guilds/${guildId}/management`);
  },

  action(guildId: string, action: PanelAction): Promise<unknown> {
    if (isMockMode) return mockDelay(action);
    const csrfToken = readCookie('dta_csrf');
    return request(`/api/guilds/${guildId}/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify(action),
    });
  },

  ranking(guildId: string): Promise<RankingEntry[]> {
    return isMockMode ? mockDelay(mockRanking) : request(`/api/guilds/${guildId}/ranking`);
  },

  audit(guildId: string): Promise<AuditEntry[]> {
    return isMockMode ? mockDelay(mockAudit) : request(`/api/guilds/${guildId}/audit`);
  },

  async logout(): Promise<void> {
    if (isMockMode) {
      mockAuthenticated = false;
      return mockDelay(undefined);
    }
    const csrfToken = readCookie('dta_csrf');
    await request('/api/auth/logout', {
      method: 'POST',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
    });
  },
};
