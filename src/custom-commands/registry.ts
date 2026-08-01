import { REST, Routes, type Guild } from 'discord.js';
import prisma from '../database/client';
import { compileDiscordCommand } from './compiler';
import { customCommandService, type CommandRegistrationState, type NativeCommandSource } from './service';

export const ADMIN_COMMAND_NAMES = new Set([
  'criar-confronto',
  'encerrar',
  'gerenciar-cargo',
  'gerenciar-pool',
  'relatorios',
  'resultado',
  'setup-cargo',
]);

export function createNativeCommandSources(
  payloads: readonly unknown[],
): NativeCommandSource[] {
  return payloads
    .filter((payload): payload is Record<string, unknown> => Boolean(payload && typeof payload === 'object'))
    .map(payload => ({
      payload,
      requireBotAdmin: ADMIN_COMMAND_NAMES.has(String(payload.name ?? '')),
    }));
}

export async function buildGuildCommandPayloads(
  guildId: string,
  nativePayloads: readonly unknown[],
): Promise<{
  payloads: unknown[];
  dynamicByName: Map<string, number>;
}> {
  const registrations = await customCommandService.listRegistrationState(guildId);
  return composeGuildCommandPayloads(guildId, nativePayloads, registrations);
}

export function composeGuildCommandPayloads(
  guildId: string,
  nativePayloads: readonly unknown[],
  registrations: readonly CommandRegistrationState[],
): { payloads: unknown[]; dynamicByName: Map<string, number> } {
  const nativeOverrides = new Map(
    registrations
      .filter(item => item.command.sourceType === 'native' && item.command.factoryCommandName)
      .map(item => [item.command.factoryCommandName!, item]),
  );
  const payloads: unknown[] = [];
  const dynamicByName = new Map<string, number>();

  for (const nativePayload of nativePayloads) {
    if (!nativePayload || typeof nativePayload !== 'object') continue;
    const record = nativePayload as Record<string, unknown>;
    const name = String(record.name ?? '');
    const override = nativeOverrides.get(name);
    if (!override) {
      payloads.push(nativePayload);
      continue;
    }
    if (!override.command.enabled) continue;
    if (!override.definition) {
      payloads.push(nativePayload);
      continue;
    }
    const compiled = compileDiscordCommand(override.definition);
    payloads.push(compiled);
    dynamicByName.set(compiled.name, override.command.id);
  }

  for (const item of registrations) {
    if (item.command.sourceType === 'native') continue;
    if (!item.command.enabled || !item.definition) continue;
    const compiled = compileDiscordCommand(item.definition);
    payloads.push(compiled);
    dynamicByName.set(compiled.name, item.command.id);
  }

  if (payloads.length > 100) {
    throw new Error(`Servidor ${guildId} excede limite de 100 comandos slash (${payloads.length}).`);
  }
  const names = payloads.map(payload => String((payload as Record<string, unknown>).name ?? ''));
  if (new Set(names).size !== names.length) {
    throw new Error(`Servidor ${guildId} possui nomes de comandos slash duplicados.`);
  }
  return { payloads, dynamicByName };
}

export async function syncGuildCommandCatalog(
  token: string,
  clientId: string,
  guild: Guild,
  nativePayloads: readonly unknown[],
): Promise<number> {
  const catalog = await buildGuildCommandPayloads(guild.id, nativePayloads);
  const rest = new REST({ version: '10' }).setToken(token);
  const response = await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
    body: catalog.payloads,
  }) as Array<{ id: string; name: string }>;
  const idByName = new Map(response.map(command => [command.name, command.id]));
  await prisma.$transaction([
    prisma.customCommand.updateMany({
      where: { guildId: guild.id },
      data: { discordCommandId: null },
    }),
    ...[...catalog.dynamicByName].flatMap(([name, commandId]) => {
      const discordCommandId = idByName.get(name);
      return discordCommandId
        ? [prisma.customCommand.update({ where: { id: commandId }, data: { discordCommandId, status: 'published' } })]
        : [];
    }),
  ]);
  return response.length;
}
