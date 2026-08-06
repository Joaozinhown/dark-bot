"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customCommandDefinitionSchema = exports.DISCORD_NAME_PATTERN = void 0;
exports.parseCustomCommandDefinition = parseCustomCommandDefinition;
exports.parseWorkflow = parseWorkflow;
exports.containsScript = containsScript;
exports.createBlankCommandDefinition = createBlankCommandDefinition;
const zod_1 = require("zod");
exports.DISCORD_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,48}$/;
const snowflakePattern = /^\d{16,22}$/;
const localizedText = (minimum, maximum) => zod_1.z.object({
    ptBR: zod_1.z.string().trim().min(minimum).max(maximum),
    enUS: zod_1.z.string().trim().min(minimum).max(maximum),
}).strict();
const localizedOptionalText = (maximum) => zod_1.z.object({
    ptBR: zod_1.z.string().max(maximum),
    enUS: zod_1.z.string().max(maximum),
}).strict();
const localizedNameSchema = zod_1.z.object({
    ptBR: zod_1.z.string().regex(exports.DISCORD_NAME_PATTERN),
    enUS: zod_1.z.string().regex(exports.DISCORD_NAME_PATTERN),
}).strict();
const choiceSchema = zod_1.z.object({
    name: localizedText(1, 100),
    value: zod_1.z.union([zod_1.z.string().max(100), zod_1.z.number().finite()]),
}).strict();
const parameterOptionSchema = zod_1.z.object({
    kind: zod_1.z.literal('parameter'),
    id: zod_1.z.string().regex(idPattern),
    key: zod_1.z.string().regex(exports.DISCORD_NAME_PATTERN),
    type: zod_1.z.enum(['string', 'integer', 'number', 'boolean', 'user', 'channel', 'role', 'mentionable', 'attachment']),
    name: localizedNameSchema,
    description: localizedText(1, 100),
    required: zod_1.z.boolean(),
    choices: zod_1.z.array(choiceSchema).max(25).optional(),
    minValue: zod_1.z.number().finite().optional(),
    maxValue: zod_1.z.number().finite().optional(),
    minLength: zod_1.z.number().int().min(0).max(6000).optional(),
    maxLength: zod_1.z.number().int().min(1).max(6000).optional(),
}).strict().superRefine((option, context) => {
    if (option.choices?.length && !['string', 'integer', 'number'].includes(option.type)) {
        context.addIssue({ code: 'custom', message: 'Choices so podem ser usados em opcoes de texto ou numero.' });
    }
    if (option.choices && option.type !== 'string'
        && option.choices.some(choice => typeof choice.value !== 'number')) {
        context.addIssue({ code: 'custom', message: 'Choices numericos precisam usar valores numericos.' });
    }
    if ((option.minLength !== undefined || option.maxLength !== undefined) && option.type !== 'string') {
        context.addIssue({ code: 'custom', message: 'Limites de tamanho so podem ser usados em texto.' });
    }
    if ((option.minValue !== undefined || option.maxValue !== undefined)
        && !['integer', 'number'].includes(option.type)) {
        context.addIssue({ code: 'custom', message: 'Limites numericos exigem opcao numerica.' });
    }
});
const subcommandSchema = zod_1.z.object({
    kind: zod_1.z.literal('subcommand'),
    id: zod_1.z.string().regex(idPattern),
    key: zod_1.z.string().regex(exports.DISCORD_NAME_PATTERN),
    name: localizedNameSchema,
    description: localizedText(1, 100),
    options: zod_1.z.array(parameterOptionSchema).max(25),
}).strict();
const subcommandGroupSchema = zod_1.z.object({
    kind: zod_1.z.literal('subcommand_group'),
    id: zod_1.z.string().regex(idPattern),
    key: zod_1.z.string().regex(exports.DISCORD_NAME_PATTERN),
    name: localizedNameSchema,
    description: localizedText(1, 100),
    options: zod_1.z.array(subcommandSchema).min(1).max(25),
}).strict();
const commandOptionSchema = zod_1.z.union([
    parameterOptionSchema,
    subcommandSchema,
    subcommandGroupSchema,
]);
const embedSchema = zod_1.z.object({
    title: localizedOptionalText(256).optional(),
    description: localizedOptionalText(4096).optional(),
    color: zod_1.z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    footer: localizedOptionalText(2048).optional(),
    fields: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        name: localizedText(1, 256),
        value: localizedText(1, 1024),
        inline: zod_1.z.boolean(),
    }).strict()).max(25),
}).strict();
const messageSchema = zod_1.z.lazy(() => zod_1.z.object({
    content: localizedOptionalText(2000).optional(),
    ephemeral: zod_1.z.boolean(),
    embeds: zod_1.z.array(embedSchema).max(10),
    components: zod_1.z.array(interactiveComponentSchema).max(5),
}).strict().superRefine((message, context) => {
    const hasContent = Boolean(message.content?.ptBR || message.content?.enUS);
    if (!hasContent && message.embeds.length === 0 && message.components.length === 0) {
        context.addIssue({ code: 'custom', message: 'A mensagem precisa ter texto, embed ou componente.' });
    }
}));
const workflowSchema = zod_1.z.lazy(() => zod_1.z.array(workflowStepSchema).max(50));
const interactiveComponentSchema = zod_1.z.lazy(() => zod_1.z.discriminatedUnion('kind', [
    zod_1.z.object({
        kind: zod_1.z.literal('button'),
        id: zod_1.z.string().regex(idPattern),
        label: localizedText(1, 80),
        style: zod_1.z.enum(['primary', 'secondary', 'success', 'danger']),
        expiresInSeconds: zod_1.z.number().int().min(30).max(604800),
        restrictToInvoker: zod_1.z.boolean(),
        workflow: workflowSchema,
    }).strict(),
    zod_1.z.object({
        kind: zod_1.z.literal('select'),
        id: zod_1.z.string().regex(idPattern),
        placeholder: localizedText(1, 150),
        minValues: zod_1.z.number().int().min(0).max(25),
        maxValues: zod_1.z.number().int().min(1).max(25),
        expiresInSeconds: zod_1.z.number().int().min(30).max(604800),
        restrictToInvoker: zod_1.z.boolean(),
        options: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().regex(idPattern),
            label: localizedText(1, 100),
            description: localizedOptionalText(100).optional(),
            value: zod_1.z.string().min(1).max(100),
        }).strict()).min(1).max(25),
        workflow: workflowSchema,
    }).strict().superRefine((component, context) => {
        if (component.minValues > component.maxValues) {
            context.addIssue({ code: 'custom', message: 'minValues nao pode ser maior que maxValues.' });
        }
        if (component.maxValues > component.options.length) {
            context.addIssue({ code: 'custom', message: 'maxValues nao pode exceder a quantidade de opcoes.' });
        }
    }),
    zod_1.z.object({
        kind: zod_1.z.literal('modal'),
        id: zod_1.z.string().regex(idPattern),
        label: localizedText(1, 80),
        style: zod_1.z.enum(['primary', 'secondary', 'success', 'danger']),
        title: localizedText(1, 45),
        expiresInSeconds: zod_1.z.number().int().min(30).max(604800),
        restrictToInvoker: zod_1.z.boolean(),
        fields: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().regex(idPattern),
            label: localizedText(1, 45),
            style: zod_1.z.enum(['short', 'paragraph']),
            required: zod_1.z.boolean(),
            placeholder: localizedOptionalText(100).optional(),
            minLength: zod_1.z.number().int().min(0).max(4000).optional(),
            maxLength: zod_1.z.number().int().min(1).max(4000).optional(),
        }).strict()).min(1).max(5),
        workflow: workflowSchema,
    }).strict(),
]));
const workflowStepSchema = zod_1.z.lazy(() => zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ id: zod_1.z.string().regex(idPattern), type: zod_1.z.literal('reply'), message: messageSchema }).strict(),
    zod_1.z.object({ id: zod_1.z.string().regex(idPattern), type: zod_1.z.literal('followup'), message: messageSchema }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('send_message'),
        channelId: zod_1.z.string().min(1).max(100),
        message: messageSchema,
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('add_role'),
        userId: zod_1.z.string().min(1).max(100),
        roleId: zod_1.z.string().min(1).max(100),
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('remove_role'),
        userId: zod_1.z.string().min(1).max(100),
        roleId: zod_1.z.string().min(1).max(100),
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('set_variable'),
        name: zod_1.z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/),
        value: zod_1.z.string().max(4000),
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('condition'),
        left: zod_1.z.string().max(500),
        operator: zod_1.z.enum(['equals', 'not_equals', 'contains', 'starts_with', 'exists']),
        right: zod_1.z.string().max(500).optional(),
        whenTrue: workflowSchema,
        whenFalse: workflowSchema,
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('random'),
        branches: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().regex(idPattern),
            weight: zod_1.z.number().int().min(1).max(1000),
            workflow: workflowSchema,
        }).strict()).min(2).max(10),
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('delay'),
        milliseconds: zod_1.z.number().int().min(0).max(5000),
    }).strict(),
    zod_1.z.object({
        id: zod_1.z.string().regex(idPattern),
        type: zod_1.z.literal('script'),
        code: zod_1.z.string().min(1).max(20000),
    }).strict(),
]));
function inspectWorkflow(workflow, depth, state) {
    if (depth > 5)
        throw new Error('Fluxo excede profundidade maxima de 5 niveis.');
    for (const step of workflow) {
        state.steps += 1;
        if (state.steps > 100)
            throw new Error('Fluxo excede limite total de 100 etapas.');
        if (step.type === 'script')
            state.scripts += 1;
        if (step.type === 'condition') {
            inspectWorkflow(step.whenTrue, depth + 1, state);
            inspectWorkflow(step.whenFalse, depth + 1, state);
        }
        if (step.type === 'random') {
            for (const branch of step.branches)
                inspectWorkflow(branch.workflow, depth + 1, state);
        }
        if ('message' in step) {
            for (const component of step.message.components)
                inspectWorkflow(component.workflow, depth + 1, state);
        }
    }
}
exports.customCommandDefinitionSchema = zod_1.z.object({
    schemaVersion: zod_1.z.literal(1),
    execution: zod_1.z.object({
        mode: zod_1.z.enum(['native', 'workflow']),
        factoryCommandName: zod_1.z.string().regex(exports.DISCORD_NAME_PATTERN).optional(),
    }).strict(),
    command: zod_1.z.object({
        name: localizedNameSchema,
        description: localizedText(1, 100),
        options: zod_1.z.array(commandOptionSchema).max(25),
        defaultMemberPermissions: zod_1.z.string().regex(/^\d+$/).nullable(),
        nsfw: zod_1.z.boolean(),
    }).strict(),
    permissions: zod_1.z.object({
        requireBotAdmin: zod_1.z.boolean(),
        allowedRoleIds: zod_1.z.array(zod_1.z.string().regex(snowflakePattern)).max(50),
        allowedUserIds: zod_1.z.array(zod_1.z.string().regex(snowflakePattern)).max(50),
        cooldownSeconds: zod_1.z.number().int().min(0).max(86400),
    }).strict(),
    workflow: workflowSchema,
}).strict().superRefine((definition, context) => {
    if (definition.execution.mode === 'native' && !definition.execution.factoryCommandName) {
        context.addIssue({ code: 'custom', path: ['execution', 'factoryCommandName'], message: 'Handler nativo obrigatorio.' });
    }
    if (definition.execution.mode === 'workflow' && definition.workflow.length === 0) {
        context.addIssue({ code: 'custom', path: ['workflow'], message: 'Fluxo visual precisa ter ao menos uma etapa.' });
    }
    const optionNames = new Set();
    for (const option of definition.command.options) {
        if (optionNames.has(option.name.ptBR)) {
            context.addIssue({ code: 'custom', path: ['command', 'options'], message: 'Nomes de opcoes precisam ser unicos.' });
        }
        optionNames.add(option.name.ptBR);
    }
    try {
        inspectWorkflow(definition.workflow, 0, { steps: 0, scripts: 0 });
    }
    catch (error) {
        context.addIssue({
            code: 'custom',
            path: ['workflow'],
            message: error instanceof Error ? error.message : 'Fluxo invalido.',
        });
    }
});
function parseCustomCommandDefinition(input) {
    return exports.customCommandDefinitionSchema.parse(input);
}
function parseWorkflow(input) {
    return workflowSchema.parse(input);
}
function containsScript(definition) {
    const state = { steps: 0, scripts: 0 };
    inspectWorkflow(definition.workflow, 0, state);
    return state.scripts > 0;
}
function createBlankCommandDefinition(name = 'novo-comando') {
    return {
        schemaVersion: 1,
        execution: { mode: 'workflow' },
        command: {
            name: { ptBR: name, enUS: name },
            description: { ptBR: 'Novo comando', enUS: 'New command' },
            options: [],
            defaultMemberPermissions: null,
            nsfw: false,
        },
        permissions: {
            requireBotAdmin: false,
            allowedRoleIds: [],
            allowedUserIds: [],
            cooldownSeconds: 0,
        },
        workflow: [{
                id: 'reply_1',
                type: 'reply',
                message: {
                    content: { ptBR: 'Resposta do comando', enUS: 'Command response' },
                    ephemeral: false,
                    embeds: [],
                    components: [],
                },
            }],
    };
}
//# sourceMappingURL=definition.js.map