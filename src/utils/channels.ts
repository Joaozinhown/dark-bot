import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  OverwriteResolvable,
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

export async function createConfrontoTextChannel(
  guild: Guild,
  timeAName: string,
  timeBName: string,
  timeARoleId: string,
  timeBRoleId: string,
  organizationRoleId: string | null,
): Promise<string> {
  const category = await getOrCreateCategory(guild, 'CONFRONTOS');

  const permissionOverwrites: OverwriteResolvable[] = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: timeARoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: timeBRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  if (organizationRoleId) {
    permissionOverwrites.push({
      id: organizationRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: buildConfrontoChannelName(timeAName, timeBName),
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites,
  });

  return channel.id;
}

export function buildConfrontoChannelName(timeAName: string, timeBName: string): string {
  const normalize = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, '-');
  return `${normalize(timeAName)}-vs-${normalize(timeBName)}`;
}

export async function deleteConfrontoChannels(
  guild: Guild,
  vozTimeAId: string | null,
  vozTimeBId: string | null,
  channelId: string | null,
): Promise<void> {
  const channelsToDelete = [vozTimeAId, vozTimeBId, channelId].filter(
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
