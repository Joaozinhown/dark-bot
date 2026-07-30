import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { panelApi } from '../lib/api';
import type { GuildResource, PanelAction } from '../types/api';

export const queryKeys = {
  health: ['health'] as const,
  session: ['session'] as const,
  guilds: ['guilds'] as const,
  guild: (guildId: string, resource: GuildResource) => ['guild', guildId, resource] as const,
};

const guildQueryOptions = {
  staleTime: 20_000,
  retry: 1,
  refetchOnWindowFocus: true,
} as const;

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: panelApi.health,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: panelApi.session,
    staleTime: 30_000,
    retry: false,
  });
}

export function useGuilds(enabled = true) {
  return useQuery({
    queryKey: queryKeys.guilds,
    queryFn: panelApi.guilds,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useOverview(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'overview'),
    queryFn: () => panelApi.overview(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function useConfrontations(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'confrontations'),
    queryFn: () => panelApi.confrontations(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function usePools(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'pools'),
    queryFn: () => panelApi.pools(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function useTeams(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'teams'),
    queryFn: () => panelApi.teams(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function useCommands(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'commands'),
    queryFn: () => panelApi.commands(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function useRanking(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'ranking'),
    queryFn: () => panelApi.ranking(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function useAudit(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'audit'),
    queryFn: () => panelApi.audit(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function usePoolDetails(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'pool-details'),
    queryFn: () => panelApi.poolDetails(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function useManagement(guildId: string) {
  return useQuery({
    queryKey: queryKeys.guild(guildId, 'management'),
    queryFn: () => panelApi.management(guildId),
    enabled: Boolean(guildId),
    ...guildQueryOptions,
  });
}

export function usePanelAction(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: PanelAction) => panelApi.action(guildId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId] });
    },
  });
}
