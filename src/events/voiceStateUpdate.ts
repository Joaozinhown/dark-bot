import { Events, VoiceState } from 'discord.js';

export const name = Events.VoiceStateUpdate;
export const once = false;

export function execute(oldState: VoiceState, newState: VoiceState) {
  // Logica para detectar quando membros entram/saem dos canais de voz
  // Pode ser usada para notificacoes ou validacoes futuras
}
