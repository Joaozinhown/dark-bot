import { z } from 'zod';
export declare const DISCORD_NAME_PATTERN: RegExp;
export interface LocalizedText {
    ptBR: string;
    enUS: string;
}
export interface CommandChoice {
    name: LocalizedText;
    value: string | number;
}
export interface ParameterOption {
    kind: 'parameter';
    id: string;
    key: string;
    type: 'string' | 'integer' | 'number' | 'boolean' | 'user' | 'channel' | 'role' | 'mentionable' | 'attachment';
    name: LocalizedText;
    description: LocalizedText;
    required: boolean;
    choices?: CommandChoice[];
    minValue?: number;
    maxValue?: number;
    minLength?: number;
    maxLength?: number;
}
export interface SubcommandOption {
    kind: 'subcommand';
    id: string;
    key: string;
    name: LocalizedText;
    description: LocalizedText;
    options: ParameterOption[];
}
export interface SubcommandGroupOption {
    kind: 'subcommand_group';
    id: string;
    key: string;
    name: LocalizedText;
    description: LocalizedText;
    options: SubcommandOption[];
}
export type CommandOption = ParameterOption | SubcommandOption | SubcommandGroupOption;
export interface EmbedTemplate {
    title?: LocalizedText;
    description?: LocalizedText;
    color?: string;
    footer?: LocalizedText;
    fields: Array<{
        id: string;
        name: LocalizedText;
        value: LocalizedText;
        inline: boolean;
    }>;
}
export interface ButtonComponent {
    kind: 'button';
    id: string;
    label: LocalizedText;
    style: 'primary' | 'secondary' | 'success' | 'danger';
    expiresInSeconds: number;
    restrictToInvoker: boolean;
    workflow: WorkflowStep[];
}
export interface SelectComponent {
    kind: 'select';
    id: string;
    placeholder: LocalizedText;
    minValues: number;
    maxValues: number;
    expiresInSeconds: number;
    restrictToInvoker: boolean;
    options: Array<{
        id: string;
        label: LocalizedText;
        description?: LocalizedText;
        value: string;
    }>;
    workflow: WorkflowStep[];
}
export interface ModalComponent {
    kind: 'modal';
    id: string;
    label: LocalizedText;
    style: 'primary' | 'secondary' | 'success' | 'danger';
    title: LocalizedText;
    expiresInSeconds: number;
    restrictToInvoker: boolean;
    fields: Array<{
        id: string;
        label: LocalizedText;
        style: 'short' | 'paragraph';
        required: boolean;
        placeholder?: LocalizedText;
        minLength?: number;
        maxLength?: number;
    }>;
    workflow: WorkflowStep[];
}
export type InteractiveComponent = ButtonComponent | SelectComponent | ModalComponent;
export interface MessageTemplate {
    content?: LocalizedText;
    ephemeral: boolean;
    embeds: EmbedTemplate[];
    components: InteractiveComponent[];
}
export type WorkflowStep = {
    id: string;
    type: 'reply' | 'followup';
    message: MessageTemplate;
} | {
    id: string;
    type: 'send_message';
    channelId: string;
    message: MessageTemplate;
} | {
    id: string;
    type: 'add_role' | 'remove_role';
    userId: string;
    roleId: string;
} | {
    id: string;
    type: 'set_variable';
    name: string;
    value: string;
} | {
    id: string;
    type: 'condition';
    left: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'exists';
    right?: string;
    whenTrue: WorkflowStep[];
    whenFalse: WorkflowStep[];
} | {
    id: string;
    type: 'random';
    branches: Array<{
        id: string;
        weight: number;
        workflow: WorkflowStep[];
    }>;
} | {
    id: string;
    type: 'delay';
    milliseconds: number;
} | {
    id: string;
    type: 'script';
    code: string;
};
export interface CustomCommandDefinition {
    schemaVersion: 1;
    execution: {
        mode: 'native' | 'workflow';
        factoryCommandName?: string;
    };
    command: {
        name: LocalizedText;
        description: LocalizedText;
        options: CommandOption[];
        defaultMemberPermissions: string | null;
        nsfw: boolean;
    };
    permissions: {
        requireBotAdmin: boolean;
        allowedRoleIds: string[];
        allowedUserIds: string[];
        cooldownSeconds: number;
    };
    workflow: WorkflowStep[];
}
export declare const customCommandDefinitionSchema: z.ZodType<CustomCommandDefinition>;
export declare function parseCustomCommandDefinition(input: unknown): CustomCommandDefinition;
export declare function parseWorkflow(input: unknown): WorkflowStep[];
export declare function containsScript(definition: CustomCommandDefinition): boolean;
export declare function createBlankCommandDefinition(name?: string): CustomCommandDefinition;
//# sourceMappingURL=definition.d.ts.map