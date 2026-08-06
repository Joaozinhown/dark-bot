"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanelActionError = exports.panelActionSchema = void 0;
const zod_1 = require("zod");
const definition_1 = require("../custom-commands/definition");
const snowflake = zod_1.z.string().regex(/^\d{16,22}$/);
const name = zod_1.z.string().trim().min(1).max(100);
const poolId = zod_1.z.number().int().positive();
exports.panelActionSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ type: zod_1.z.literal('pool.create'), name: name.max(80), format: zod_1.z.enum(['MD3', 'MD5']) }),
    zod_1.z.object({ type: zod_1.z.literal('pool.add-map'), poolId, name }),
    zod_1.z.object({ type: zod_1.z.literal('pool.remove-map'), poolId, name }),
    zod_1.z.object({ type: zod_1.z.literal('pool.add-killer'), poolId, name }),
    zod_1.z.object({ type: zod_1.z.literal('pool.remove-killer'), poolId, name }),
    zod_1.z.object({ type: zod_1.z.literal('pool.toggle'), poolId }),
    zod_1.z.object({ type: zod_1.z.literal('pool.delete'), poolId }),
    zod_1.z.object({ type: zod_1.z.literal('team.create'), name: name.max(80), color: zod_1.z.string().regex(/^#[0-9a-f]{6}$/i) }),
    zod_1.z.object({ type: zod_1.z.literal('team.rename'), roleId: snowflake, name: name.max(80) }),
    zod_1.z.object({ type: zod_1.z.literal('team.delete'), roleId: snowflake }),
    zod_1.z.object({ type: zod_1.z.literal('team.member-add'), roleId: snowflake, userId: snowflake }),
    zod_1.z.object({ type: zod_1.z.literal('team.member-remove'), roleId: snowflake, userId: snowflake }),
    zod_1.z.object({ type: zod_1.z.literal('permission.set-admin-roles'), roleIds: zod_1.z.array(snowflake).max(20) }),
    zod_1.z.object({
        type: zod_1.z.literal('permission.set-script-access'),
        roleIds: zod_1.z.array(snowflake).max(20),
        userIds: zod_1.z.array(snowflake).max(50),
    }),
    zod_1.z.object({ type: zod_1.z.literal('command.set-enabled'), commandName: zod_1.z.string().regex(/^[a-z0-9-]{1,32}$/), enabled: zod_1.z.boolean() }),
    zod_1.z.object({
        type: zod_1.z.literal('command.save-draft'),
        commandId: zod_1.z.number().int().positive().nullable(),
        sourceType: zod_1.z.enum(['native', 'custom']),
        factoryCommandName: zod_1.z.string().regex(/^[a-z0-9_-]{1,32}$/).nullable(),
        definition: definition_1.customCommandDefinitionSchema,
    }),
    zod_1.z.object({ type: zod_1.z.literal('command.publish'), commandId: zod_1.z.number().int().positive() }),
    zod_1.z.object({
        type: zod_1.z.literal('command.rollback'),
        commandId: zod_1.z.number().int().positive(),
        versionId: zod_1.z.number().int().positive(),
    }),
    zod_1.z.object({ type: zod_1.z.literal('command.archive'), commandId: zod_1.z.number().int().positive() }),
    zod_1.z.object({
        type: zod_1.z.literal('command.clone'),
        commandId: zod_1.z.number().int().positive(),
        targetGuildId: snowflake,
        name: zod_1.z.object({
            ptBR: zod_1.z.string().regex(/^[a-z0-9_-]{1,32}$/),
            enUS: zod_1.z.string().regex(/^[a-z0-9_-]{1,32}$/),
        }).strict(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('command.set-dynamic-enabled'),
        commandId: zod_1.z.number().int().positive(),
        enabled: zod_1.z.boolean(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('command.preview'),
        definition: definition_1.customCommandDefinitionSchema,
        simulation: zod_1.z.object({
            locale: zod_1.z.enum(['pt-BR', 'en-US']).optional(),
            options: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        }).strict().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('confrontation.create'),
        poolId,
        teamARoleId: snowflake,
        teamBRoleId: snowflake,
        channelId: snowflake,
    }),
    zod_1.z.object({ type: zod_1.z.literal('confrontation.result'), confrontationId: zod_1.z.number().int().positive(), winnerRoleId: snowflake }),
    zod_1.z.object({ type: zod_1.z.literal('confrontation.close'), confrontationId: zod_1.z.number().int().positive(), reason: zod_1.z.string().trim().max(500).nullable() }),
]);
class PanelActionError extends Error {
    code;
    statusCode;
    constructor(code, message, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'PanelActionError';
    }
}
exports.PanelActionError = PanelActionError;
//# sourceMappingURL=panel-actions.js.map