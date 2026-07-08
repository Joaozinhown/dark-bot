import { Events, Client } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client: Client) {
  console.log(`[Dark Bot] Logado como ${client.user?.tag}`);
  console.log(`[Dark Bot] Servidores: ${client.guilds.cache.size}`);
}
