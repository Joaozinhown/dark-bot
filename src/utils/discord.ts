export interface DiscordCurrentUser {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string | null;
  bot?: boolean;
}

export async function fetchDiscordCurrentUser(token: string): Promise<DiscordCurrentUser> {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bot ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body ? ` Resposta: ${body.slice(0, 200)}` : '';
    throw new Error(`Discord recusou o DISCORD_TOKEN (${response.status} ${response.statusText}).${detail}`);
  }

  return response.json() as Promise<DiscordCurrentUser>;
}

export function formatDiscordUser(user: DiscordCurrentUser): string {
  const discriminator = user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : '';
  return `${user.username}${discriminator} (${user.id})`;
}
