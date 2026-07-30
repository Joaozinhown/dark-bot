import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isMockMode } from '../lib/api';

export type RealtimeStatus = 'connected' | 'reconnecting' | 'idle';

interface RealtimeState {
  status: RealtimeStatus;
  lastEventAt: Date | null;
}

export function useRealtimeSync(guildId: string): RealtimeState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>({
    status: guildId ? 'reconnecting' : 'idle',
    lastEventAt: null,
  });

  useEffect(() => {
    if (!guildId) {
      setState({ status: 'idle', lastEventAt: null });
      return;
    }
    if (isMockMode) {
      setState({ status: 'connected', lastEventAt: new Date() });
      return;
    }

    const events = new EventSource(`/api/guilds/${guildId}/events`, { withCredentials: true });
    events.onopen = () => setState(previous => ({ ...previous, status: 'connected' }));
    events.onmessage = () => {
      setState({ status: 'connected', lastEventAt: new Date() });
      void queryClient.invalidateQueries({ queryKey: ['guild', guildId] });
    };
    events.onerror = () => setState(previous => ({ ...previous, status: 'reconnecting' }));

    const resourceEvents = [
      'confrontation.created',
      'confrontation.updated',
      'confrontation.closed',
      'pool.updated',
      'role.updated',
      'command.updated',
      'bot.ready',
      'pool.create',
      'pool.add-map',
      'pool.remove-map',
      'pool.add-killer',
      'pool.remove-killer',
      'pool.toggle',
      'pool.delete',
      'team.create',
      'team.rename',
      'team.delete',
      'team.member-add',
      'team.member-remove',
      'permission.set-admin-roles',
      'command.set-enabled',
      'confrontation.create',
      'confrontation.result',
      'confrontation.close',
      'veto.pick',
      'veto.ban',
    ];
    const handleResourceEvent = () => {
      setState({ status: 'connected', lastEventAt: new Date() });
      void queryClient.invalidateQueries({ queryKey: ['guild', guildId] });
    };
    resourceEvents.forEach(type => events.addEventListener(type, handleResourceEvent));

    return () => {
      resourceEvents.forEach(type => events.removeEventListener(type, handleResourceEvent));
      events.close();
    };
  }, [guildId, queryClient]);

  return state;
}
