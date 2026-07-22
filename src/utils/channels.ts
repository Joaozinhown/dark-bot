import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

export async function createTeamVoiceChannel(
  guild: Guild,
  teamName: string,
  teamRoleId: string,
  confrontoId: number,
): Promise<string> {
  const category = await getOrCreateCategory(guild, 'CONFRONTOS');

  const channel = await guild.channels.create({
    name: `${teamName} — Confronto #${confrontoId}`,
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.Connect],
      },
      {
        id: teamRoleId,
        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
    ],
  });

  return channel.id;
}

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

async function getOrCreateCategory(guild: Guild, name: string): Promise<any> {
  const existing = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name === name,
  );

  if (existing) {
    return existing;
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
  });
}
