"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canExecuteDynamicCommand = canExecuteDynamicCommand;
exports.executeDynamicCommand = executeDynamicCommand;
exports.handleDynamicComponent = handleDynamicComponent;
exports.adaptInteractionForNativeHandler = adaptInteractionForNativeHandler;
exports.simulateDefinition = simulateDefinition;
const discord_js_1 = require("discord.js");
const audit_service_1 = require("../services/audit-service");
const permissions_1 = require("../utils/permissions");
const interaction_state_1 = require("./interaction-state");
const sandbox_1 = require("./sandbox");
const cooldowns = new Map();
function localeOf(interaction) {
    return interaction.locale === discord_js_1.Locale.PortugueseBR ? 'pt-BR' : 'en-US';
}
function localize(value, locale) {
    if (!value)
        return '';
    return locale === 'pt-BR' ? value.ptBR : value.enUS;
}
function valueAtPath(path, interaction, context) {
    const normalized = path.trim();
    const fixed = {
        'user.id': interaction.user.id,
        'user.username': interaction.user.username,
        'guild.id': interaction.guildId ?? '',
        'guild.name': interaction.guild?.name ?? '',
        'channel.id': interaction.channelId,
        'component.value': context.componentValues[0] ?? '',
        'component.values': context.componentValues.join(','),
    };
    if (normalized in fixed)
        return fixed[normalized];
    if (normalized.startsWith('option.'))
        return context.options[normalized.slice(7)];
    if (normalized.startsWith('var.'))
        return context.variables[normalized.slice(4)];
    if (normalized.startsWith('modal.'))
        return context.modalValues[normalized.slice(6)];
    return undefined;
}
function renderTemplate(value, interaction, context) {
    return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path) => {
        const resolved = valueAtPath(path, interaction, context);
        return resolved === undefined || resolved === null ? '' : String(resolved);
    });
}
function resolveReference(value, interaction, context) {
    const rendered = renderTemplate(value, interaction, context).trim();
    return rendered || value;
}
function componentStyle(style) {
    return {
        primary: discord_js_1.ButtonStyle.Primary,
        secondary: discord_js_1.ButtonStyle.Secondary,
        success: discord_js_1.ButtonStyle.Success,
        danger: discord_js_1.ButtonStyle.Danger,
    }[style];
}
function findComponent(workflow, nodeId) {
    for (const step of workflow) {
        if ('message' in step) {
            for (const component of step.message.components) {
                if (component.id === nodeId)
                    return component;
                const nested = findComponent(component.workflow, nodeId);
                if (nested)
                    return nested;
            }
        }
        if (step.type === 'condition') {
            const nested = findComponent([...step.whenTrue, ...step.whenFalse], nodeId);
            if (nested)
                return nested;
        }
        if (step.type === 'random') {
            const nested = findComponent(step.branches.flatMap(branch => branch.workflow), nodeId);
            if (nested)
                return nested;
        }
    }
    return null;
}
async function buildComponents(message, interaction, runtime, identity) {
    const rows = [];
    const locale = localeOf(interaction);
    for (const component of message.components) {
        if (!interaction.guildId)
            continue;
        const snapshot = {
            userId: interaction.user.id,
            options: runtime.options,
            variables: runtime.variables,
        };
        const token = await interaction_state_1.customInteractionState.create({
            guildId: interaction.guildId,
            commandId: identity.commandId,
            commandVersionId: identity.commandVersionId,
            nodeId: component.id,
            context: snapshot,
            allowedUserId: component.restrictToInvoker ? interaction.user.id : null,
            expiresInSeconds: component.expiresInSeconds,
        });
        if (component.kind === 'select') {
            const select = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId((0, interaction_state_1.interactionCustomId)(token))
                .setPlaceholder(renderTemplate(localize(component.placeholder, locale), interaction, runtime))
                .setMinValues(component.minValues)
                .setMaxValues(component.maxValues)
                .addOptions(component.options.map(option => {
                const builder = new discord_js_1.StringSelectMenuOptionBuilder()
                    .setLabel(renderTemplate(localize(option.label, locale), interaction, runtime))
                    .setValue(option.value);
                const description = renderTemplate(localize(option.description, locale), interaction, runtime);
                return description ? builder.setDescription(description) : builder;
            }));
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(select));
            continue;
        }
        const button = new discord_js_1.ButtonBuilder()
            .setCustomId((0, interaction_state_1.interactionCustomId)(token))
            .setLabel(renderTemplate(localize(component.label, locale), interaction, runtime))
            .setStyle(componentStyle(component.style));
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(button));
    }
    return rows;
}
async function renderMessage(template, interaction, runtime, identity) {
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
        ...(template.ephemeral ? { flags: discord_js_1.MessageFlags.Ephemeral } : {}),
    };
}
function evaluateCondition(step, interaction, context) {
    const left = renderTemplate(step.left, interaction, context);
    const right = renderTemplate(step.right ?? '', interaction, context);
    if (step.operator === 'exists')
        return left.trim().length > 0;
    if (step.operator === 'equals')
        return left === right;
    if (step.operator === 'not_equals')
        return left !== right;
    if (step.operator === 'contains')
        return left.includes(right);
    return left.startsWith(right);
}
function randomBranch(step) {
    const total = step.branches.reduce((sum, branch) => sum + branch.weight, 0);
    let cursor = Math.random() * total;
    for (const branch of step.branches) {
        cursor -= branch.weight;
        if (cursor <= 0)
            return branch.workflow;
    }
    return step.branches.at(-1)?.workflow ?? [];
}
function sandboxContext(interaction, runtime) {
    return {
        user: { id: interaction.user.id, username: interaction.user.username },
        guild: { id: interaction.guildId ?? '', name: interaction.guild?.name ?? '' },
        channel: { id: interaction.channelId ?? '' },
        locale: localeOf(interaction),
        options: runtime.options,
        variables: runtime.variables,
    };
}
async function executeSteps(steps, interaction, initial, identity, depth = 0) {
    if (depth > 6)
        throw new Error('Profundidade de execucao excedida.');
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
            runtime = await executeSteps(evaluateCondition(step, interaction, runtime) ? step.whenTrue : step.whenFalse, interaction, runtime, identity, depth + 1);
            continue;
        }
        if (step.type === 'random') {
            runtime = await executeSteps(randomBranch(step), interaction, runtime, identity, depth + 1);
            continue;
        }
        if (step.type === 'script') {
            const result = await (0, sandbox_1.runSandboxScript)(step.code, sandboxContext(interaction, runtime));
            runtime = await executeSteps(result.workflow, interaction, runtime, identity, depth + 1);
            continue;
        }
        if (step.type === 'delay') {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            }
            await new Promise(resolve => setTimeout(resolve, step.milliseconds));
            continue;
        }
        if (step.type === 'reply' || step.type === 'followup') {
            const payload = await renderMessage(step.message, interaction, runtime, identity);
            if (interaction.deferred && !interaction.replied) {
                const { flags: _flags, ...editable } = payload;
                await interaction.editReply(editable);
            }
            else if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(payload);
            }
            else {
                await interaction.followUp(payload);
            }
            continue;
        }
        if (step.type === 'send_message') {
            const channelId = resolveReference(step.channelId, interaction, runtime);
            const channel = await interaction.guild?.channels.fetch(channelId);
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText)
                throw new Error('Canal de texto configurado nao encontrado.');
            const payload = await renderMessage(step.message, interaction, runtime, identity);
            const { flags: _flags, ...messagePayload } = payload;
            await channel.send(messagePayload);
            continue;
        }
        if (!('userId' in step))
            continue;
        const userId = resolveReference(step.userId, interaction, runtime);
        const roleId = resolveReference(step.roleId, interaction, runtime);
        const [member, role] = await Promise.all([
            interaction.guild?.members.fetch(userId),
            interaction.guild?.roles.fetch(roleId),
        ]);
        if (!member || !role || !role.editable)
            throw new Error('Usuario ou cargo nao gerenciavel neste servidor.');
        if (step.type === 'add_role')
            await member.roles.add(role);
        else
            await member.roles.remove(role);
    }
    return runtime;
}
function optionDefinitionByName(options, name) {
    for (const option of options) {
        if ([option.key, option.name.ptBR, option.name.enUS].includes(name))
            return option;
        if (option.kind === 'subcommand_group') {
            const nested = optionDefinitionByName(option.options, name);
            if (nested)
                return nested;
        }
        if (option.kind === 'subcommand') {
            const nested = optionDefinitionByName(option.options, name);
            if (nested)
                return nested;
        }
    }
    return null;
}
function extractOptions(interaction, definition) {
    const values = {};
    const visit = (items) => {
        for (const item of items) {
            const name = String(item.name ?? '');
            const option = optionDefinitionByName(definition.command.options, name);
            const nested = Array.isArray(item.options) ? item.options : [];
            if (nested.length) {
                if (option?.kind === 'subcommand')
                    values.subcommand = option.key;
                if (option?.kind === 'subcommand_group')
                    values.subcommandGroup = option.key;
                visit(nested);
                continue;
            }
            const value = item.value ?? item.user?.id
                ?? item.member?.user?.id
                ?? item.role?.id
                ?? item.channel?.id
                ?? item.attachment?.id;
            values[option?.key ?? name] = value;
        }
    };
    visit(interaction.options.data);
    return values;
}
async function canExecuteDynamicCommand(interaction, definition, commandId) {
    if (!interaction.guild || !interaction.guildId)
        return { allowed: false, message: 'Comando disponivel somente em servidores.' };
    const member = interaction.member instanceof discord_js_1.GuildMember
        ? interaction.member
        : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member)
        return { allowed: false, message: 'Nao foi possivel validar suas permissoes.' };
    if (definition.permissions.requireBotAdmin && !(await (0, permissions_1.hasBotAdminPermission)(member))) {
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
async function executeDynamicCommand(interaction, input) {
    const runtime = {
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
    }
    else if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
            content: localeOf(interaction) === 'pt-BR' ? 'Comando executado.' : 'Command completed.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
function buildModal(component, interaction) {
    const locale = localeOf(interaction);
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(interaction.customId)
        .setTitle(localize(component.title, locale));
    for (const field of component.fields) {
        const input = new discord_js_1.TextInputBuilder()
            .setCustomId(field.id)
            .setLabel(localize(field.label, locale))
            .setStyle(field.style === 'paragraph' ? discord_js_1.TextInputStyle.Paragraph : discord_js_1.TextInputStyle.Short)
            .setRequired(field.required);
        const placeholder = localize(field.placeholder, locale);
        if (placeholder)
            input.setPlaceholder(placeholder);
        if (field.minLength !== undefined)
            input.setMinLength(field.minLength);
        if (field.maxLength !== undefined)
            input.setMaxLength(field.maxLength);
        modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
    }
    return modal;
}
async function handleDynamicComponent(interaction) {
    const token = (0, interaction_state_1.readInteractionToken)(interaction.customId);
    if (!token || !interaction.guildId)
        return false;
    const state = await interaction_state_1.customInteractionState.resolve(interaction.guildId, token);
    if (!state) {
        await interaction.reply({ content: 'Esta interacao expirou ou nao existe mais.', flags: discord_js_1.MessageFlags.Ephemeral });
        return true;
    }
    if (state.allowedUserId && state.allowedUserId !== interaction.user.id) {
        await interaction.reply({ content: 'Esta interacao pertence a outro usuario.', flags: discord_js_1.MessageFlags.Ephemeral });
        return true;
    }
    const component = findComponent(state.definition.workflow, state.nodeId);
    if (!component) {
        await interaction.reply({ content: 'Fluxo publicado nao contem mais este componente.', flags: discord_js_1.MessageFlags.Ephemeral });
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
    const runtime = {
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
    }
    else if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
            content: localeOf(interaction) === 'pt-BR' ? 'Interacao concluida.' : 'Interaction completed.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    await audit_service_1.auditService.write({
        guildId: interaction.guildId,
        actorUserId: interaction.user.id,
        action: 'command.component.executed',
        entityType: 'command',
        entityId: String(state.commandId),
        details: { versionId: state.commandVersionId, componentId: component.id, componentKind: component.kind },
    });
    return true;
}
function publicNameForKey(definition, key) {
    return optionDefinitionByName(definition.command.options, key)?.name.ptBR ?? key;
}
function adaptInteractionForNativeHandler(interaction, definition, factoryCommandName) {
    const optionMethods = new Set([
        'get', 'getString', 'getInteger', 'getNumber', 'getBoolean', 'getUser', 'getMember',
        'getChannel', 'getRole', 'getMentionable', 'getAttachment',
    ]);
    const options = new Proxy(interaction.options, {
        get(target, property, receiver) {
            if (property === 'getSubcommand') {
                return (required) => {
                    const selected = target.getSubcommand(required ?? false);
                    return selected ? optionDefinitionByName(definition.command.options, selected)?.key ?? selected : selected;
                };
            }
            if (property === 'getSubcommandGroup') {
                return (required) => {
                    const selected = target.getSubcommandGroup(required);
                    return selected ? optionDefinitionByName(definition.command.options, selected)?.key ?? selected : selected;
                };
            }
            const original = Reflect.get(target, property, receiver);
            if (typeof property === 'string' && optionMethods.has(property) && typeof original === 'function') {
                return (name, ...args) => original.call(target, publicNameForKey(definition, name), ...args);
            }
            return typeof original === 'function' ? original.bind(target) : original;
        },
    });
    return new Proxy(interaction, {
        get(target, property, receiver) {
            if (property === 'commandName')
                return factoryCommandName;
            if (property === 'options')
                return options;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}
function simulatedValue(path, input, runtime) {
    const fixed = {
        'user.id': input.userId,
        'user.username': input.username,
        'guild.id': input.guildId,
        'guild.name': input.guildName,
        'channel.id': input.channelId,
    };
    if (path in fixed)
        return fixed[path];
    if (path.startsWith('option.'))
        return runtime.options[path.slice(7)];
    if (path.startsWith('var.'))
        return runtime.variables[path.slice(4)];
    return undefined;
}
async function simulateDefinition(definition, input = {}) {
    const resolved = {
        locale: input.locale ?? 'pt-BR',
        options: input.options ?? {},
        userId: input.userId ?? '000000000000000001',
        username: input.username ?? 'preview-user',
        guildId: input.guildId ?? '000000000000000002',
        guildName: input.guildName ?? 'Preview Guild',
        channelId: input.channelId ?? '000000000000000003',
    };
    const actions = [];
    const scriptLogs = [];
    let runtime = { options: resolved.options, variables: {}, componentValues: [], modalValues: {} };
    const render = (value) => value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path) => {
        const found = simulatedValue(path, resolved, runtime);
        return found === undefined || found === null ? '' : String(found);
    });
    const walk = async (steps, depth = 0) => {
        if (depth > 6)
            throw new Error('Profundidade de simulacao excedida.');
        for (const step of steps) {
            if (step.type === 'set_variable') {
                runtime = { ...runtime, variables: { ...runtime.variables, [step.name]: render(step.value) } };
            }
            else if (step.type === 'condition') {
                const left = render(step.left);
                const right = render(step.right ?? '');
                const matched = step.operator === 'exists' ? Boolean(left)
                    : step.operator === 'equals' ? left === right
                        : step.operator === 'not_equals' ? left !== right
                            : step.operator === 'contains' ? left.includes(right)
                                : left.startsWith(right);
                await walk(matched ? step.whenTrue : step.whenFalse, depth + 1);
            }
            else if (step.type === 'random') {
                actions.push({ type: 'random', selectedBranch: step.branches[0]?.id ?? null, note: 'Preview usa primeira ramificacao.' });
                await walk(step.branches[0]?.workflow ?? [], depth + 1);
            }
            else if (step.type === 'script') {
                const result = await (0, sandbox_1.runSandboxScript)(step.code, {
                    user: { id: resolved.userId, username: resolved.username },
                    guild: { id: resolved.guildId, name: resolved.guildName },
                    channel: { id: resolved.channelId },
                    locale: resolved.locale,
                    options: runtime.options,
                    variables: runtime.variables,
                });
                scriptLogs.push(...result.logs);
                await walk(result.workflow, depth + 1);
            }
            else if (step.type === 'reply' || step.type === 'followup' || step.type === 'send_message') {
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
            }
            else if (step.type === 'delay') {
                actions.push({ type: 'delay', milliseconds: step.milliseconds });
            }
            else {
                if ('userId' in step) {
                    actions.push({ type: step.type, userId: render(step.userId), roleId: render(step.roleId) });
                }
            }
        }
    };
    await walk(definition.workflow);
    return { actions, scriptLogs };
}
//# sourceMappingURL=executor.js.map