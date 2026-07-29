import { z } from 'zod';

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
  z.object({ type: z.literal('command.set-enabled'), commandName: z.string().regex(/^[a-z0-9-]{1,32}$/), enabled: z.boolean() }),
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
