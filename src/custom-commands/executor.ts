import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  Locale,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type InteractionReplyOptions,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { auditService } from '../services/audit-service';
import { hasBotAdminPermission } from '../utils/permissions';
import {
  type CommandOption,
  type CustomCommandDefinition,
  type InteractiveComponent,
  type LocalizedText,
  type MessageTemplate,
  type WorkflowStep,
} from './definition';
import {
  customInteractionState,
  interactionCustomId,
  readInteractionToken,
  type InteractionContextSnapshot,
} from './interaction-state';
import { runSandboxScript, type SandboxContext } from './sandbox';

type DynamicComponentInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

interface RuntimeContext {
  readonly options: Readonly<Record<string, unknown>>;
  readonly variables: Readonly<Record<string, string>>;
  readonly componentValues: readonly string[];
  readonly modalValues: Readonly<Record<string, string>>;
}

interface ExecutionIdentity {
  readonly commandId: number;
  readonly commandVersionId: number;
}

export interface SimulationInput {
  readonly locale?: 'pt-BR' | 'en-US';
  readonly options?: Readonly<Record<string, unknown>>;
  readonly userId?: string;
  readonly username?: string;
  readonly guildId?: string;
  readonly guildName?: string;
  readonly channelId?: string;
}

export interface SimulationResult {
  readonly actions: Array<Readonly<Record<string, unknown>>>;
  readonly scriptLogs: string[];
}

const cooldowns = new Map<string, number>();

function localeOf(interaction: RepliableInteraction): 'pt-BR' | 'en-US' {
  return interaction.locale === Locale.PortugueseBR ? 'pt-BR' : 'en-US';
}

function localize(value: LocalizedText | undefined, locale: 'pt-BR' | 'en-US'): string {
  if (!value) return '';
  return locale === 'pt-BR' ? value.ptBR : value.enUS;
}

function valueAtPath(path: string, interaction: RepliableInteraction, context: RuntimeContext): unknown {
  const normalized = path.trim();
  const fixed: Record<string, unknown> = {
    'user.id': interaction.user.id,
    'user.username': interaction.user.username,
    'guild.id': interaction.guildId ?? '',
    'guild.name': interaction.guild?.name ?? '',
    'channel.id': interaction.channelId,
    'component.value': context.componentValues[0] ?? '',
    'component.values': context.componentValues.join(','),
  };
  if (normalized in fixed) return fixed[normalized];
  if (normalized.startsWith('option.')) return context.options[normalized.slice(7)];
  if (normalized.startsWith('var.')) return context.variables[normalized.slice(4)];
  if (normalized.startsWith('modal.')) return context.modalValues[normalized.slice(6)];
  return undefined;
}

function renderTemplate(value: string, interaction: RepliableInteraction, context: RuntimeContext): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const resolved = valueAtPath(path, interaction, context);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

function resolveReference(value: string, interaction: RepliableInteraction, context: RuntimeContext): string {
  const rendered = renderTemplate(value, interaction, context).trim();
  return rendered || value;
}

function componentStyle(style: 'primary' | 'secondary' | 'success' | 'danger'): ButtonStyle {
  return {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
  }[style];
}

function findComponent(workflow: readonly WorkflowStep[], nodeId: string): InteractiveComponent | null {
  for (const step of workflow) {
    if ('message' in step) {
      for (const component of step.message.components) {
        if (component.id === nodeId) return component;
        const nested = findComponent(component.workflow, nodeId);
        if (nested) return nested;
      }
    }
    if (step.type === 'condition') {
      const nested = findComponent([...step.whenTrue, ...step.whenFalse], nodeId);
      if (nested) return nested;
    }
    if (step.type === 'random') {
      const nested = findComponent(step.branches.flatMap(branch => branch.workflow), nodeId);
      if (nested) return nested;
    }
  }
  return null;
}

async function buildComponents(
  message: MessageTemplate,
  interaction: RepliableInteraction,
  runtime: RuntimeContext,
  identity: ExecutionIdentity,
): Promise<Array<ActionRowBuilder<MessageActionRowComponentBuilder>>> {
  const rows: Array<ActionRowBuilder<MessageActionRowComponentBuilder>> = [];
  const locale = localeOf(interaction);
  for (const component of message.components) {
    if (!interaction.guildId) continue;
    const snapshot: InteractionContextSnapshot = {
      userId: interaction.user.id,
      options: runtime.options,
      variables: runtime.variables,
    };
    const token = await customInteractionState.create({
      guildId: interaction.guildId,
      commandId: identity.commandId,
      commandVersionId: identity.commandVersionId,
      nodeId: component.id,
      context: snapshot,
      allowedUserId: component.restrictToInvoker ? interaction.user.id : null,
      expiresInSeconds: component.expiresInSeconds,
    });
    if (component.kind === 'select') {
      const select = new StringSelectMenuBuilder()
        .setCustomId(interactionCustomId(token))
        .setPlaceholder(renderTemplate(localize(component.placeholder, locale), interaction, runtime))
        .setMinValues(component.minValues)
        .setMaxValues(component.maxValues)
        .addOptions(component.options.map(option => {
          const builder = new StringSelectMenuOptionBuilder()
            .setLabel(renderTemplate(localize(option.label, locale), interaction, runtime))
            .setValue(option.value);
          const description = renderTemplate(localize(option.description, locale), interaction, runtime);
          return description ? builder.setDescription(description) : builder;
        }));
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select));
      continue;
    }
    const button = new ButtonBuilder()
      .setCustomId(interactionCustomId(token))
      .setLabel(renderTemplate(localize(component.label, locale), interaction, runtime))
      .setStyle(componentStyle(component.style));
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(button));
  }
  return rows;
}

async function renderMessage(
  template: MessageTemplate,
  interaction: RepliableInteraction,
  runtime: RuntimeContext,
  identity: ExecutionIdentity,
): Promise<InteractionReplyOptions> {
  const locale = localeOf(interaction);
  const content = renderTemplate(localize(template.content, locale), interaction, runtime);
  return {
    ...(content ? { content } : {}),
    embeds: template.embeds.map(embed => ({
      ...(localize(embed.title, locale) ? { title: renderTemplate(localize(embed.title, locale), interaction, runtime) } : {}),
      ...(localize(embed.description, locale) ? { description: renderTemplate(localize(embed.description, locale), interaction, runtime) } : {}),
      ...(embed.color ? { color: Number.parseInt(embed.color.slice(1), 16) } : {}),
      ...(localize(embed.footer, locale) ? { footer: { text: renderTemplate(localize(embed.footer, locale), interaction, runtime) } } : {}),
      fields: embed.fields.map(field => ({
        name: renderTemplate(localize(field.name, locale), interaction, runtime),
        value: renderTemplate(localize(field.value, locale), interaction, runtime),
        inline: field.inline,
      })),
    })),
    components: await buildComponents(template, interaction, runtime, identity),
    allowedMentions: { parse: [] },
    ...(template.ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
  };
}

function evaluateCondition(step: Extract<WorkflowStep, { type: 'condition' }>, interaction: RepliableInteraction, context: RuntimeContext): boolean {
  const left = renderTemplate(step.left, interaction, context);
  const right = renderTemplate(step.right ?? '', interaction, context);
  if (step.operator === 'exists') return left.trim().length > 0;
  if (step.operator === 'equals') return left === right;
  if (step.operator === 'not_equals') return left !== right;
  if (step.operator === 'contains') return left.includes(right);
  return left.startsWith(right);
}

function randomBranch(step: Extract<WorkflowStep, { type: 'random' }>): WorkflowStep[] {
  const total = step.branches.reduce((sum, branch) => sum + branch.weight, 0);
  let cursor = Math.random() * total;
  for (const branch of step.branches) {
    cursor -= branch.weight;
    if (cursor <= 0) return branch.workflow;
  }
  return step.branches.at(-1)?.workflow ?? [];
}

function sandboxContext(interaction: RepliableInteraction, runtime: RuntimeContext): SandboxContext {
  return {
    user: { id: interaction.user.id, username: interaction.user.username },
    guild: { id: interaction.guildId ?? '', name: interaction.guild?.name ?? '' },
    channel: { id: interaction.channelId ?? '' },
    locale: localeOf(interaction),
    options: runtime.options,
    variables: runtime.variables,
  };
}

async function executeSteps(
  steps: readonly WorkflowStep[],
  interaction: RepliableInteraction,
  initial: RuntimeContext,
  identity: ExecutionIdentity,
  depth = 0,
): Promise<RuntimeContext> {
  if (depth > 6) throw new Error('Profundidade de execucao excedida.');
  let runtime = initial;
  for (const step of steps) {
    if (step.type === 'set_variable') {
      runtime = {
        ...runtime,
        variables: {
          ...runtime.variables,
          [step.name]: renderTemplate(step.value, interaction, runtime),
        },
      };
      continue;
    }
    if (step.type === 'condition') {
      runtime = await executeSteps(
        evaluateCondition(step, interaction, runtime) ? step.whenTrue : step.whenFalse,
        interaction,
        runtime,
        identity,
        depth + 1,
      );
      continue;
    }
    if (step.type === 'random') {
      runtime = await executeSteps(randomBranch(step), interaction, runtime, identity, depth + 1);
      continue;
    }
    if (step.type === 'script') {
      const result = await runSandboxScript(step.code, sandboxContext(interaction, runtime));
      runtime = await executeSteps(result.workflow, interaction, runtime, identity, depth + 1);
      continue;
    }
    if (step.type === 'delay') {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
      await new Promise(resolve => setTimeout(resolve, step.milliseconds));
      continue;
    }
    if (step.type === 'reply' || step.type === 'followup') {
      const payload = await renderMessage(step.message, interaction, runtime, identity);
      if (interaction.deferred && !interaction.replied) {
        const { flags: _flags, ...editable } = payload;
        await interaction.editReply(editable);
      } else if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(payload);
      } else {
        await interaction.followUp(payload);
      }
      continue;
    }
    if (step.type === 'send_message') {
      const channelId = resolveReference(step.channelId, interaction, runtime);
      const channel = await interaction.guild?.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Canal de texto configurado nao encontrado.');
      const payload = await renderMessage(step.message, interaction, runtime, identity);
      const { flags: _flags, ...messagePayload } = payload;
      await channel.send(messagePayload);
      continue;
    }
    if (!('userId' in step)) continue;
    const userId = resolveReference(step.userId, interaction, runtime);
    const roleId = resolveReference(step.roleId, interaction, runtime);
    const [member, role] = await Promise.all([
      interaction.guild?.members.fetch(userId),
      interaction.guild?.roles.fetch(roleId),
    ]);
    if (!member || !role || !role.editable) throw new Error('Usuario ou cargo nao gerenciavel neste servidor.');
    if (step.type === 'add_role') await member.roles.add(role);
    else await member.roles.remove(role);
  }
  return runtime;
}

function optionDefinitionByName(options: readonly CommandOption[], name: string): CommandOption | null {
  for (const option of options) {
    if ([option.key, option.name.ptBR, option.name.enUS].includes(name)) return option;
    if (option.kind === 'subcommand_group') {
      const nested = optionDefinitionByName(option.options, name);
      if (nested) return nested;
    }
    if (option.kind === 'subcommand') {
      const nested = optionDefinitionByName(option.options, name);
      if (nested) return nested;
    }
  }
  return null;
}

function extractOptions(interaction: ChatInputCommandInteraction, definition: CustomCommandDefinition): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const visit = (items: readonly Record<string, unknown>[]) => {
    for (const item of items) {
      const name = String(item.name ?? '');
      const option = optionDefinitionByName(definition.command.options, name);
      const nested = Array.isArray(item.options) ? item.options as Record<string, unknown>[] : [];
      if (nested.length) {
        if (option?.kind === 'subcommand') values.subcommand = option.key;
        if (option?.kind === 'subcommand_group') values.subcommandGroup = option.key;
        visit(nested);
        continue;
      }
      const value = item.value ?? (item.user as { id?: string } | undefined)?.id
        ?? (item.member as { user?: { id?: string } } | undefined)?.user?.id
        ?? (item.role as { id?: string } | undefined)?.id
        ?? (item.channel as { id?: string } | undefined)?.id
        ?? (item.attachment as { id?: string } | undefined)?.id;
      values[option?.key ?? name] = value;
    }
  };
  visit(interaction.options.data as unknown as Record<string, unknown>[]);
  return values;
}

export async function canExecuteDynamicCommand(
  interaction: ChatInputCommandInteraction,
  definition: CustomCommandDefinition,
  commandId: number,
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  if (!interaction.guild || !interaction.guildId) return { allowed: false, message: 'Comando disponivel somente em servidores.' };
  const member = interaction.member instanceof GuildMember
    ? interaction.member
    : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return { allowed: false, message: 'Nao foi possivel validar suas permissoes.' };
  if (definition.permissions.requireBotAdmin && !(await hasBotAdminPermission(member))) {
    return { allowed: false, message: 'Voce nao tem permissao administrativa para usar este comando.' };
  }
  const allowedUsers = definition.permissions.allowedUserIds;
  const allowedRoles = new Set(definition.permissions.allowedRoleIds);
  if (allowedUsers.length || allowedRoles.size) {
    const roleMatch = [...member.roles.cache.keys()].some(roleId => allowedRoles.has(roleId));
    if (!allowedUsers.includes(interaction.user.id) && !roleMatch) {
      return { allowed: false, message: 'Seu usuario ou cargo nao tem acesso a este comando.' };
    }
  }
  const cooldownSeconds = definition.permissions.cooldownSeconds;
  if (cooldownSeconds > 0) {
    const key = `${interaction.guildId}:${commandId}:${interaction.user.id}`;
    const expiresAt = cooldowns.get(key) ?? 0;
    if (expiresAt > Date.now()) {
      return { allowed: false, message: `Aguarde ${Math.ceil((expiresAt - Date.now()) / 1000)}s para usar novamente.` };
    }
    cooldowns.set(key, Date.now() + cooldownSeconds * 1000);
  }
  return { allowed: true };
}

export async function executeDynamicCommand(
  interaction: ChatInputCommandInteraction,
  input: { commandId: number; versionId: number; definition: CustomCommandDefinition },
): Promise<void> {
  const runtime: RuntimeContext = {
    options: extractOptions(interaction, input.definition),
    variables: {},
    componentValues: [],
    modalValues: {},
  };
  await executeSteps(input.definition.workflow, interaction, runtime, {
    commandId: input.commandId,
    commandVersionId: input.versionId,
  });
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ content: localeOf(interaction) === 'pt-BR' ? 'Comando executado.' : 'Command completed.' });
  } else if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: localeOf(interaction) === 'pt-BR' ? 'Comando executado.' : 'Command completed.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

function buildModal(
  component: Extract<InteractiveComponent, { kind: 'modal' }>,
  interaction: ButtonInteraction,
): ModalBuilder {
  const locale = localeOf(interaction);
  const modal = new ModalBuilder()
    .setCustomId(interaction.customId)
    .setTitle(localize(component.title, locale));
  for (const field of component.fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(localize(field.label, locale))
      .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required);
    const placeholder = localize(field.placeholder, locale);
    if (placeholder) input.setPlaceholder(placeholder);
    if (field.minLength !== undefined) input.setMinLength(field.minLength);
    if (field.maxLength !== undefined) input.setMaxLength(field.maxLength);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }
  return modal;
}

export async function handleDynamicComponent(interaction: DynamicComponentInteraction): Promise<boolean> {
  const token = readInteractionToken(interaction.customId);
  if (!token || !interaction.guildId) return false;
  const state = await customInteractionState.resolve(interaction.guildId, token);
  if (!state) {
    await interaction.reply({ content: 'Esta interacao expirou ou nao existe mais.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (state.allowedUserId && state.allowedUserId !== interaction.user.id) {
    await interaction.reply({ content: 'Esta interacao pertence a outro usuario.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const component = findComponent(state.definition.workflow, state.nodeId);
  if (!component) {
    await interaction.reply({ content: 'Fluxo publicado nao contem mais este componente.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (component.kind === 'modal' && interaction.isButton()) {
    await interaction.showModal(buildModal(component, interaction));
    return true;
  }
  const componentValues = interaction.isStringSelectMenu() ? interaction.values : [];
  const modalValues = interaction.isModalSubmit()
    ? Object.fromEntries(component.kind === 'modal'
      ? component.fields.map(field => [field.id, interaction.fields.getTextInputValue(field.id)])
      : [])
    : {};
  const runtime: RuntimeContext = {
    options: state.context.options,
    variables: state.context.variables,
    componentValues,
    modalValues,
  };
  await executeSteps(component.workflow, interaction, runtime, {
    commandId: state.commandId,
    commandVersionId: state.commandVersionId,
  });
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ content: localeOf(interaction) === 'pt-BR' ? 'Interacao concluida.' : 'Interaction completed.' });
  } else if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: localeOf(interaction) === 'pt-BR' ? 'Interacao concluida.' : 'Interaction completed.',
      flags: MessageFlags.Ephemeral,
    });
  }
  await auditService.write({
    guildId: interaction.guildId,
    actorUserId: interaction.user.id,
    action: 'command.component.executed',
    entityType: 'command',
    entityId: String(state.commandId),
    details: { versionId: state.commandVersionId, componentId: component.id, componentKind: component.kind },
  });
  return true;
}

function publicNameForKey(definition: CustomCommandDefinition, key: string): string {
  return optionDefinitionByName(definition.command.options, key)?.name.ptBR ?? key;
}

export function adaptInteractionForNativeHandler(
  interaction: ChatInputCommandInteraction,
  definition: CustomCommandDefinition,
  factoryCommandName: string,
): ChatInputCommandInteraction {
  const optionMethods = new Set([
    'get', 'getString', 'getInteger', 'getNumber', 'getBoolean', 'getUser', 'getMember',
    'getChannel', 'getRole', 'getMentionable', 'getAttachment',
  ]);
  const options = new Proxy(interaction.options, {
    get(target, property, receiver) {
      if (property === 'getSubcommand') {
        return (required?: boolean) => {
          const selected = target.getSubcommand(required ?? false);
          return selected ? optionDefinitionByName(definition.command.options, selected)?.key ?? selected : selected;
        };
      }
      if (property === 'getSubcommandGroup') {
        return (required?: boolean) => {
          const selected = target.getSubcommandGroup(required);
          return selected ? optionDefinitionByName(definition.command.options, selected)?.key ?? selected : selected;
        };
      }
      const original = Reflect.get(target, property, receiver);
      if (typeof property === 'string' && optionMethods.has(property) && typeof original === 'function') {
        return (name: string, ...args: unknown[]) => original.call(target, publicNameForKey(definition, name), ...args);
      }
      return typeof original === 'function' ? original.bind(target) : original;
    },
  });
  return new Proxy(interaction, {
    get(target, property, receiver) {
      if (property === 'commandName') return factoryCommandName;
      if (property === 'options') return options;
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function simulatedValue(path: string, input: Required<SimulationInput>, runtime: RuntimeContext): unknown {
  const fixed: Record<string, unknown> = {
    'user.id': input.userId,
    'user.username': input.username,
    'guild.id': input.guildId,
    'guild.name': input.guildName,
    'channel.id': input.channelId,
  };
  if (path in fixed) return fixed[path];
  if (path.startsWith('option.')) return runtime.options[path.slice(7)];
  if (path.startsWith('var.')) return runtime.variables[path.slice(4)];
  return undefined;
}

export async function simulateDefinition(
  definition: CustomCommandDefinition,
  input: SimulationInput = {},
): Promise<SimulationResult> {
  const resolved: Required<SimulationInput> = {
    locale: input.locale ?? 'pt-BR',
    options: input.options ?? {},
    userId: input.userId ?? '000000000000000001',
    username: input.username ?? 'preview-user',
    guildId: input.guildId ?? '000000000000000002',
    guildName: input.guildName ?? 'Preview Guild',
    channelId: input.channelId ?? '000000000000000003',
  };
  const actions: Array<Record<string, unknown>> = [];
  const scriptLogs: string[] = [];
  let runtime: RuntimeContext = { options: resolved.options, variables: {}, componentValues: [], modalValues: {} };
  const render = (value: string) => value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const found = simulatedValue(path, resolved, runtime);
    return found === undefined || found === null ? '' : String(found);
  });
  const walk = async (steps: readonly WorkflowStep[], depth = 0): Promise<void> => {
    if (depth > 6) throw new Error('Profundidade de simulacao excedida.');
    for (const step of steps) {
      if (step.type === 'set_variable') {
        runtime = { ...runtime, variables: { ...runtime.variables, [step.name]: render(step.value) } };
      } else if (step.type === 'condition') {
        const left = render(step.left);
        const right = render(step.right ?? '');
        const matched = step.operator === 'exists' ? Boolean(left)
          : step.operator === 'equals' ? left === right
            : step.operator === 'not_equals' ? left !== right
              : step.operator === 'contains' ? left.includes(right)
                : left.startsWith(right);
        await walk(matched ? step.whenTrue : step.whenFalse, depth + 1);
      } else if (step.type === 'random') {
        actions.push({ type: 'random', selectedBranch: step.branches[0]?.id ?? null, note: 'Preview usa primeira ramificacao.' });
        await walk(step.branches[0]?.workflow ?? [], depth + 1);
      } else if (step.type === 'script') {
        const result = await runSandboxScript(step.code, {
          user: { id: resolved.userId, username: resolved.username },
          guild: { id: resolved.guildId, name: resolved.guildName },
          channel: { id: resolved.channelId },
          locale: resolved.locale,
          options: runtime.options,
          variables: runtime.variables,
        });
        scriptLogs.push(...result.logs);
        await walk(result.workflow, depth + 1);
      } else if (step.type === 'reply' || step.type === 'followup' || step.type === 'send_message') {
        actions.push({
          type: step.type,
          ...('channelId' in step ? { channelId: render(step.channelId) } : {}),
          content: render(localize(step.message.content, resolved.locale)),
          embeds: step.message.embeds.map(embed => ({
            title: render(localize(embed.title, resolved.locale)),
            description: render(localize(embed.description, resolved.locale)),
          })),
          components: step.message.components.map(component => ({ kind: component.kind, id: component.id })),
          ephemeral: step.message.ephemeral,
        });
      } else if (step.type === 'delay') {
        actions.push({ type: 'delay', milliseconds: step.milliseconds });
      } else {
        if ('userId' in step) {
          actions.push({ type: step.type, userId: render(step.userId), roleId: render(step.roleId) });
        }
      }
    }
  };
  await walk(definition.workflow);
  return { actions, scriptLogs };
}
