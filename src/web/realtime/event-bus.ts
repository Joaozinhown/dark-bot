export interface GuildEvent {
  id: number;
  guildId: string;
  type: string;
  data: Readonly<Record<string, unknown>>;
}

type GuildEventListener = (event: GuildEvent) => void;

export function createGuildEventBus() {
  const listeners = new Map<string, Set<GuildEventListener>>();
  const sequences = new Map<string, number>();

  return {
    subscribe(guildId: string, listener: GuildEventListener): () => void {
      const guildListeners = listeners.get(guildId) ?? new Set<GuildEventListener>();
      guildListeners.add(listener);
      listeners.set(guildId, guildListeners);

      return () => {
        const current = listeners.get(guildId);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) listeners.delete(guildId);
      };
    },

    publish(guildId: string, type: string, data: Readonly<Record<string, unknown>>): GuildEvent {
      const id = (sequences.get(guildId) ?? 0) + 1;
      sequences.set(guildId, id);
      const event: GuildEvent = { id, guildId, type, data };
      for (const listener of listeners.get(guildId) ?? []) {
        try {
          listener(event);
        } catch {
          // A disconnected subscriber cannot interrupt the bot operation that published the event.
        }
      }
      return event;
    },
  };
}

export type GuildEventBus = ReturnType<typeof createGuildEventBus>;

export const guildEventBus = createGuildEventBus();
