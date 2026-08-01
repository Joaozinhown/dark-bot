import { z } from 'zod';

export const DISCORD_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,48}$/;
const snowflakePattern = /^\d{16,22}$/;

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

export type WorkflowStep =
  | { id: string; type: 'reply' | 'followup'; message: MessageTemplate }
  | { id: string; type: 'send_message'; channelId: string; message: MessageTemplate }
  | { id: string; type: 'add_role' | 'remove_role'; userId: string; roleId: string }
  | { id: string; type: 'set_variable'; name: string; value: string }
  | {
    id: string;
    type: 'condition';
    left: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'exists';
    right?: string;
    whenTrue: WorkflowStep[];
    whenFalse: WorkflowStep[];
  }
  | { id: string; type: 'random'; branches: Array<{ id: string; weight: number; workflow: WorkflowStep[] }> }
  | { id: string; type: 'delay'; milliseconds: number }
  | { id: string; type: 'script'; code: string };

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

const localizedText = (minimum: number, maximum: number) => z.object({
  ptBR: z.string().trim().min(minimum).max(maximum),
  enUS: z.string().trim().min(minimum).max(maximum),
}).strict();

const localizedOptionalText = (maximum: number) => z.object({
  ptBR: z.string().max(maximum),
  enUS: z.string().max(maximum),
}).strict();

const localizedNameSchema = z.object({
  ptBR: z.string().regex(DISCORD_NAME_PATTERN),
  enUS: z.string().regex(DISCORD_NAME_PATTERN),
}).strict();

const choiceSchema = z.object({
  name: localizedText(1, 100),
  value: z.union([z.string().max(100), z.number().finite()]),
}).strict();

const parameterOptionSchema: z.ZodType<ParameterOption> = z.object({
  kind: z.literal('parameter'),
  id: z.string().regex(idPattern),
  key: z.string().regex(DISCORD_NAME_PATTERN),
  type: z.enum(['string', 'integer', 'number', 'boolean', 'user', 'channel', 'role', 'mentionable', 'attachment']),
  name: localizedNameSchema,
  description: localizedText(1, 100),
  required: z.boolean(),
  choices: z.array(choiceSchema).max(25).optional(),
  minValue: z.number().finite().optional(),
  maxValue: z.number().finite().optional(),
  minLength: z.number().int().min(0).max(6000).optional(),
  maxLength: z.number().int().min(1).max(6000).optional(),
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

const subcommandSchema: z.ZodType<SubcommandOption> = z.object({
  kind: z.literal('subcommand'),
  id: z.string().regex(idPattern),
  key: z.string().regex(DISCORD_NAME_PATTERN),
  name: localizedNameSchema,
  description: localizedText(1, 100),
  options: z.array(parameterOptionSchema).max(25),
}).strict();

const subcommandGroupSchema: z.ZodType<SubcommandGroupOption> = z.object({
  kind: z.literal('subcommand_group'),
  id: z.string().regex(idPattern),
  key: z.string().regex(DISCORD_NAME_PATTERN),
  name: localizedNameSchema,
  description: localizedText(1, 100),
  options: z.array(subcommandSchema).min(1).max(25),
}).strict();

const commandOptionSchema: z.ZodType<CommandOption> = z.union([
  parameterOptionSchema,
  subcommandSchema,
  subcommandGroupSchema,
]);

const embedSchema: z.ZodType<EmbedTemplate> = z.object({
  title: localizedOptionalText(256).optional(),
  description: localizedOptionalText(4096).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  footer: localizedOptionalText(2048).optional(),
  fields: z.array(z.object({
    id: z.string().regex(idPattern),
    name: localizedText(1, 256),
    value: localizedText(1, 1024),
    inline: z.boolean(),
  }).strict()).max(25),
}).strict();

const messageSchema: z.ZodType<MessageTemplate> = z.lazy(() => z.object({
  content: localizedOptionalText(2000).optional(),
  ephemeral: z.boolean(),
  embeds: z.array(embedSchema).max(10),
  components: z.array(interactiveComponentSchema).max(5),
}).strict().superRefine((message, context) => {
  const hasContent = Boolean(message.content?.ptBR || message.content?.enUS);
  if (!hasContent && message.embeds.length === 0 && message.components.length === 0) {
    context.addIssue({ code: 'custom', message: 'A mensagem precisa ter texto, embed ou componente.' });
  }
}));

const workflowSchema: z.ZodType<WorkflowStep[]> = z.lazy(() => z.array(workflowStepSchema).max(50));

const interactiveComponentSchema: z.ZodType<InteractiveComponent> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('button'),
    id: z.string().regex(idPattern),
    label: localizedText(1, 80),
    style: z.enum(['primary', 'secondary', 'success', 'danger']),
    expiresInSeconds: z.number().int().min(30).max(604800),
    restrictToInvoker: z.boolean(),
    workflow: workflowSchema,
  }).strict(),
  z.object({
    kind: z.literal('select'),
    id: z.string().regex(idPattern),
    placeholder: localizedText(1, 150),
    minValues: z.number().int().min(0).max(25),
    maxValues: z.number().int().min(1).max(25),
    expiresInSeconds: z.number().int().min(30).max(604800),
    restrictToInvoker: z.boolean(),
    options: z.array(z.object({
      id: z.string().regex(idPattern),
      label: localizedText(1, 100),
      description: localizedOptionalText(100).optional(),
      value: z.string().min(1).max(100),
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
  z.object({
    kind: z.literal('modal'),
    id: z.string().regex(idPattern),
    label: localizedText(1, 80),
    style: z.enum(['primary', 'secondary', 'success', 'danger']),
    title: localizedText(1, 45),
    expiresInSeconds: z.number().int().min(30).max(604800),
    restrictToInvoker: z.boolean(),
    fields: z.array(z.object({
      id: z.string().regex(idPattern),
      label: localizedText(1, 45),
      style: z.enum(['short', 'paragraph']),
      required: z.boolean(),
      placeholder: localizedOptionalText(100).optional(),
      minLength: z.number().int().min(0).max(4000).optional(),
      maxLength: z.number().int().min(1).max(4000).optional(),
    }).strict()).min(1).max(5),
    workflow: workflowSchema,
  }).strict(),
]));

const workflowStepSchema: z.ZodType<WorkflowStep> = z.lazy(() => z.discriminatedUnion('type', [
  z.object({ id: z.string().regex(idPattern), type: z.literal('reply'), message: messageSchema }).strict(),
  z.object({ id: z.string().regex(idPattern), type: z.literal('followup'), message: messageSchema }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('send_message'),
    channelId: z.string().min(1).max(100),
    message: messageSchema,
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('add_role'),
    userId: z.string().min(1).max(100),
    roleId: z.string().min(1).max(100),
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('remove_role'),
    userId: z.string().min(1).max(100),
    roleId: z.string().min(1).max(100),
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('set_variable'),
    name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/),
    value: z.string().max(4000),
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('condition'),
    left: z.string().max(500),
    operator: z.enum(['equals', 'not_equals', 'contains', 'starts_with', 'exists']),
    right: z.string().max(500).optional(),
    whenTrue: workflowSchema,
    whenFalse: workflowSchema,
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('random'),
    branches: z.array(z.object({
      id: z.string().regex(idPattern),
      weight: z.number().int().min(1).max(1000),
      workflow: workflowSchema,
    }).strict()).min(2).max(10),
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('delay'),
    milliseconds: z.number().int().min(0).max(5000),
  }).strict(),
  z.object({
    id: z.string().regex(idPattern),
    type: z.literal('script'),
    code: z.string().min(1).max(20000),
  }).strict(),
]));

function inspectWorkflow(workflow: readonly WorkflowStep[], depth: number, state: { steps: number; scripts: number }): void {
  if (depth > 5) throw new Error('Fluxo excede profundidade maxima de 5 niveis.');
  for (const step of workflow) {
    state.steps += 1;
    if (state.steps > 100) throw new Error('Fluxo excede limite total de 100 etapas.');
    if (step.type === 'script') state.scripts += 1;
    if (step.type === 'condition') {
      inspectWorkflow(step.whenTrue, depth + 1, state);
      inspectWorkflow(step.whenFalse, depth + 1, state);
    }
    if (step.type === 'random') {
      for (const branch of step.branches) inspectWorkflow(branch.workflow, depth + 1, state);
    }
    if ('message' in step) {
      for (const component of step.message.components) inspectWorkflow(component.workflow, depth + 1, state);
    }
  }
}

export const customCommandDefinitionSchema: z.ZodType<CustomCommandDefinition> = z.object({
  schemaVersion: z.literal(1),
  execution: z.object({
    mode: z.enum(['native', 'workflow']),
    factoryCommandName: z.string().regex(DISCORD_NAME_PATTERN).optional(),
  }).strict(),
  command: z.object({
    name: localizedNameSchema,
    description: localizedText(1, 100),
    options: z.array(commandOptionSchema).max(25),
    defaultMemberPermissions: z.string().regex(/^\d+$/).nullable(),
    nsfw: z.boolean(),
  }).strict(),
  permissions: z.object({
    requireBotAdmin: z.boolean(),
    allowedRoleIds: z.array(z.string().regex(snowflakePattern)).max(50),
    allowedUserIds: z.array(z.string().regex(snowflakePattern)).max(50),
    cooldownSeconds: z.number().int().min(0).max(86400),
  }).strict(),
  workflow: workflowSchema,
}).strict().superRefine((definition, context) => {
  if (definition.execution.mode === 'native' && !definition.execution.factoryCommandName) {
    context.addIssue({ code: 'custom', path: ['execution', 'factoryCommandName'], message: 'Handler nativo obrigatorio.' });
  }
  if (definition.execution.mode === 'workflow' && definition.workflow.length === 0) {
    context.addIssue({ code: 'custom', path: ['workflow'], message: 'Fluxo visual precisa ter ao menos uma etapa.' });
  }
  const optionNames = new Set<string>();
  for (const option of definition.command.options) {
    if (optionNames.has(option.name.ptBR)) {
      context.addIssue({ code: 'custom', path: ['command', 'options'], message: 'Nomes de opcoes precisam ser unicos.' });
    }
    optionNames.add(option.name.ptBR);
  }
  try {
    inspectWorkflow(definition.workflow, 0, { steps: 0, scripts: 0 });
  } catch (error: unknown) {
    context.addIssue({
      code: 'custom',
      path: ['workflow'],
      message: error instanceof Error ? error.message : 'Fluxo invalido.',
    });
  }
});

export function parseCustomCommandDefinition(input: unknown): CustomCommandDefinition {
  return customCommandDefinitionSchema.parse(input);
}

export function parseWorkflow(input: unknown): WorkflowStep[] {
  return workflowSchema.parse(input);
}

export function containsScript(definition: CustomCommandDefinition): boolean {
  const state = { steps: 0, scripts: 0 };
  inspectWorkflow(definition.workflow, 0, state);
  return state.scripts > 0;
}

export function createBlankCommandDefinition(name = 'novo-comando'): CustomCommandDefinition {
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
