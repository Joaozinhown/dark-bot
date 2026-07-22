import { Guild } from 'discord.js';

export async function deleteConfrontoVoiceChannels(
  guild: Guild,
  vozTimeAId: string | null,
  vozTimeBId: string | null,
): Promise<void> {
  const channelsToDelete = [vozTimeAId, vozTimeBId].filter(
    (id): id is string => id !== null,
  );

  for (const channelId of channelsToDelete) {
    try {
      const channel = await guild.channels.fetch(channelId);
      if (channel) {
        await channel.delete();
      }
    } catch (error) {
      console.error(`[Channels] Erro ao deletar canal ${channelId}:`, error);
    }
  }
}
