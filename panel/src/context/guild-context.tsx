import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGuilds } from '../hooks/use-panel-data';
import type { Guild } from '../types/api';

const STORAGE_KEY = 'dta:selected-guild';

interface GuildContextValue {
  guilds: Guild[];
  selectedGuild: Guild | null;
  selectedGuildId: string;
  selectGuild: (guildId: string) => void;
  isPending: boolean;
  error: Error | null;
  refetch: () => void;
}

const GuildContext = createContext<GuildContextValue | null>(null);

function readStoredGuildId(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function GuildProvider({ children }: { children: ReactNode }) {
  const guildQuery = useGuilds();
  const [selectedGuildId, setSelectedGuildId] = useState(readStoredGuildId);
  const guilds = guildQuery.data ?? [];

  useEffect(() => {
    if (guilds.length === 0) return;
    if (guilds.some(guild => guild.id === selectedGuildId)) return;
    setSelectedGuildId(guilds[0]!.id);
  }, [guilds, selectedGuildId]);

  const selectGuild = (guildId: string) => {
    if (!guilds.some(guild => guild.id === guildId)) return;
    setSelectedGuildId(guildId);
    try {
      sessionStorage.setItem(STORAGE_KEY, guildId);
    } catch {
      // Session storage can be unavailable in hardened browser profiles.
    }
  };

  const value = useMemo<GuildContextValue>(() => ({
    guilds,
    selectedGuild: guilds.find(guild => guild.id === selectedGuildId) ?? null,
    selectedGuildId,
    selectGuild,
    isPending: guildQuery.isPending,
    error: guildQuery.error,
    refetch: () => {
      void guildQuery.refetch();
    },
  }), [guildQuery.error, guildQuery.isPending, guildQuery.refetch, guilds, selectedGuildId]);

  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>;
}

export function useGuildContext(): GuildContextValue {
  const context = useContext(GuildContext);
  if (!context) throw new Error('useGuildContext precisa estar dentro de GuildProvider.');
  return context;
}
