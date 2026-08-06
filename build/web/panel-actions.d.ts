import { z } from 'zod';
export declare const panelActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"pool.create">;
    name: z.ZodString;
    format: z.ZodEnum<{
        MD3: "MD3";
        MD5: "MD5";
    }>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pool.add-map">;
    poolId: z.ZodNumber;
    name: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pool.remove-map">;
    poolId: z.ZodNumber;
    name: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pool.add-killer">;
    poolId: z.ZodNumber;
    name: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pool.remove-killer">;
    poolId: z.ZodNumber;
    name: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pool.toggle">;
    poolId: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pool.delete">;
    poolId: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"team.create">;
    name: z.ZodString;
    color: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"team.rename">;
    roleId: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"team.delete">;
    roleId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"team.member-add">;
    roleId: z.ZodString;
    userId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"team.member-remove">;
    roleId: z.ZodString;
    userId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"permission.set-admin-roles">;
    roleIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"permission.set-script-access">;
    roleIds: z.ZodArray<z.ZodString>;
    userIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.set-enabled">;
    commandName: z.ZodString;
    enabled: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.save-draft">;
    commandId: z.ZodNullable<z.ZodNumber>;
    sourceType: z.ZodEnum<{
        native: "native";
        custom: "custom";
    }>;
    factoryCommandName: z.ZodNullable<z.ZodString>;
    definition: z.ZodType<import("../custom-commands/definition").CustomCommandDefinition, unknown, z.core.$ZodTypeInternals<import("../custom-commands/definition").CustomCommandDefinition, unknown>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.publish">;
    commandId: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.rollback">;
    commandId: z.ZodNumber;
    versionId: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.archive">;
    commandId: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.clone">;
    commandId: z.ZodNumber;
    targetGuildId: z.ZodString;
    name: z.ZodObject<{
        ptBR: z.ZodString;
        enUS: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.set-dynamic-enabled">;
    commandId: z.ZodNumber;
    enabled: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"command.preview">;
    definition: z.ZodType<import("../custom-commands/definition").CustomCommandDefinition, unknown, z.core.$ZodTypeInternals<import("../custom-commands/definition").CustomCommandDefinition, unknown>>;
    simulation: z.ZodOptional<z.ZodObject<{
        locale: z.ZodOptional<z.ZodEnum<{
            "pt-BR": "pt-BR";
            "en-US": "en-US";
        }>>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strict>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"confrontation.create">;
    poolId: z.ZodNumber;
    teamARoleId: z.ZodString;
    teamBRoleId: z.ZodString;
    channelId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"confrontation.result">;
    confrontationId: z.ZodNumber;
    winnerRoleId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"confrontation.close">;
    confrontationId: z.ZodNumber;
    reason: z.ZodNullable<z.ZodString>;
}, z.core.$strip>], "type">;
export type PanelAction = z.infer<typeof panelActionSchema>;
export declare class PanelActionError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
//# sourceMappingURL=panel-actions.d.ts.map