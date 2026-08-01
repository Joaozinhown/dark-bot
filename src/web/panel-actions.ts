import { z } from 'zod';
import { customCommandDefinitionSchema } from '../custom-commands/definition';

const snowflake = z.string().regex(/^\d{16,22}$/);
const name = z.string().trim().min(1).max(100);
const poolId = z.number().int().positive();

export const panelActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pool.create'), name: name.max(80), format: z.enum(['MD3', 'MD5']) }),
  z.object({ type: z.literal('pool.add-map'), poolId, name }),
  z.object({ type: z.literal('pool.remove-map'), poolId, name }),
  z.object({ type: z.literal('pool.add-killer'), poolId, name }),
  z.object({ type: z.literal('pool.remove-killer'), poolId, name }),
  z.object({ type: z.literal('pool.toggle'), poolId }),
  z.object({ type: z.literal('pool.delete'), poolId }),
  z.object({ type: z.literal('team.create'), name: name.max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  z.object({ type: z.literal('team.rename'), roleId: snowflake, name: name.max(80) }),
  z.object({ type: z.literal('team.delete'), roleId: snowflake }),
  z.object({ type: z.literal('team.member-add'), roleId: snowflake, userId: snowflake }),
  z.object({ type: z.literal('team.member-remove'), roleId: snowflake, userId: snowflake }),
  z.object({ type: z.literal('permission.set-admin-roles'), roleIds: z.array(snowflake).max(20) }),
  z.object({
    type: z.literal('permission.set-script-access'),
    roleIds: z.array(snowflake).max(20),
    userIds: z.array(snowflake).max(50),
  }),
  z.object({ type: z.literal('command.set-enabled'), commandName: z.string().regex(/^[a-z0-9-]{1,32}$/), enabled: z.boolean() }),
  z.object({
    type: z.literal('command.save-draft'),
    commandId: z.number().int().positive().nullable(),
    sourceType: z.enum(['native', 'custom']),
    factoryCommandName: z.string().regex(/^[a-z0-9_-]{1,32}$/).nullable(),
    definition: customCommandDefinitionSchema,
  }),
  z.object({ type: z.literal('command.publish'), commandId: z.number().int().positive() }),
  z.object({
    type: z.literal('command.rollback'),
    commandId: z.number().int().positive(),
    versionId: z.number().int().positive(),
  }),
  z.object({ type: z.literal('command.archive'), commandId: z.number().int().positive() }),
  z.object({
    type: z.literal('command.clone'),
    commandId: z.number().int().positive(),
    targetGuildId: snowflake,
    name: z.object({
      ptBR: z.string().regex(/^[a-z0-9_-]{1,32}$/),
      enUS: z.string().regex(/^[a-z0-9_-]{1,32}$/),
    }).strict(),
  }),
  z.object({
    type: z.literal('command.set-dynamic-enabled'),
    commandId: z.number().int().positive(),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('command.preview'),
    definition: customCommandDefinitionSchema,
    simulation: z.object({
      locale: z.enum(['pt-BR', 'en-US']).optional(),
      options: z.record(z.string(), z.unknown()).optional(),
    }).strict().optional(),
  }),
  z.object({
    type: z.literal('confrontation.create'),
    poolId,
    teamARoleId: snowflake,
    teamBRoleId: snowflake,
    channelId: snowflake,
  }),
  z.object({ type: z.literal('confrontation.result'), confrontationId: z.number().int().positive(), winnerRoleId: snowflake }),
  z.object({ type: z.literal('confrontation.close'), confrontationId: z.number().int().positive(), reason: z.string().trim().max(500).nullable() }),
]);

export type PanelAction = z.infer<typeof panelActionSchema>;

export class PanelActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'PanelActionError';
  }
}
