"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileDiscordCommand = compileDiscordCommand;
exports.createNativeFactoryDefinition = createNativeFactoryDefinition;
const definition_1 = require("./definition");
const OPTION_TYPES = {
    subcommand: 1,
    subcommand_group: 2,
    string: 3,
    integer: 4,
    boolean: 5,
    user: 6,
    channel: 7,
    role: 8,
    mentionable: 9,
    number: 10,
    attachment: 11,
};
function localizations(value) {
    return { 'pt-BR': value.ptBR, 'en-US': value.enUS };
}
function compileParameter(option) {
    return {
        type: OPTION_TYPES[option.type],
        name: option.name.ptBR,
        name_localizations: localizations(option.name),
        description: option.description.ptBR,
        description_localizations: localizations(option.description),
        required: option.required,
        ...(option.choices ? {
            choices: option.choices.map(choice => ({
                name: choice.name.ptBR,
                name_localizations: localizations(choice.name),
                value: choice.value,
            })),
        } : {}),
        ...(option.minValue !== undefined ? { min_value: option.minValue } : {}),
        ...(option.maxValue !== undefined ? { max_value: option.maxValue } : {}),
        ...(option.minLength !== undefined ? { min_length: option.minLength } : {}),
        ...(option.maxLength !== undefined ? { max_length: option.maxLength } : {}),
    };
}
function compileSubcommand(option) {
    return {
        type: OPTION_TYPES.subcommand,
        name: option.name.ptBR,
        name_localizations: localizations(option.name),
        description: option.description.ptBR,
        description_localizations: localizations(option.description),
        options: option.options.map(compileParameter),
    };
}
function compileGroup(option) {
    return {
        type: OPTION_TYPES.subcommand_group,
        name: option.name.ptBR,
        name_localizations: localizations(option.name),
        description: option.description.ptBR,
        description_localizations: localizations(option.description),
        options: option.options.map(compileSubcommand),
    };
}
function compileOption(option) {
    if (option.kind === 'parameter')
        return compileParameter(option);
    if (option.kind === 'subcommand')
        return compileSubcommand(option);
    return compileGroup(option);
}
function commandTextSize(payload) {
    let size = payload.name.length + payload.description.length;
    const visit = (value) => {
        if (typeof value === 'string')
            size += value.length;
        if (Array.isArray(value))
            value.forEach(visit);
        if (value && typeof value === 'object')
            Object.values(value).forEach(visit);
    };
    visit(payload.name_localizations);
    visit(payload.description_localizations);
    visit(payload.options);
    return size;
}
function compileDiscordCommand(input) {
    const definition = (0, definition_1.parseCustomCommandDefinition)(input);
    const payload = {
        name: definition.command.name.ptBR,
        name_localizations: localizations(definition.command.name),
        description: definition.command.description.ptBR,
        description_localizations: localizations(definition.command.description),
        options: definition.command.options.map(compileOption),
        default_member_permissions: definition.command.defaultMemberPermissions,
        dm_permission: false,
        nsfw: definition.command.nsfw,
        type: 1,
    };
    if (commandTextSize(payload) > 8000) {
        throw new Error('Estrutura do comando excede limite total de 8000 caracteres do Discord.');
    }
    return payload;
}
function text(value, fallback) {
    const localizations = value && typeof value === 'object'
        ? value
        : {};
    return {
        ptBR: typeof localizations['pt-BR'] === 'string' ? localizations['pt-BR'] : fallback,
        enUS: typeof localizations['en-US'] === 'string' ? localizations['en-US'] : fallback,
    };
}
function readString(record, key, fallback = '') {
    return typeof record[key] === 'string' ? record[key] : fallback;
}
function fromParameter(raw, index) {
    const reverseTypes = {
        3: 'string', 4: 'integer', 5: 'boolean', 6: 'user', 7: 'channel',
        8: 'role', 9: 'mentionable', 10: 'number', 11: 'attachment',
    };
    const key = readString(raw, 'name', `option-${index + 1}`);
    const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
    return {
        kind: 'parameter',
        id: `option_${index + 1}_${key}`.slice(0, 48),
        key,
        type: reverseTypes[Number(raw.type)] ?? 'string',
        name: text(raw.name_localizations, key),
        description: text(raw.description_localizations, readString(raw, 'description', key)),
        required: raw.required === true,
        ...(rawChoices.length ? {
            choices: rawChoices.map((choice, choiceIndex) => {
                const choiceRecord = choice;
                const fallback = readString(choiceRecord, 'name', `choice-${choiceIndex + 1}`);
                const value = choiceRecord.value;
                return {
                    name: text(choiceRecord.name_localizations, fallback),
                    value: typeof value === 'number' ? value : String(value ?? ''),
                };
            }),
        } : {}),
        ...(typeof raw.min_value === 'number' ? { minValue: raw.min_value } : {}),
        ...(typeof raw.max_value === 'number' ? { maxValue: raw.max_value } : {}),
        ...(typeof raw.min_length === 'number' ? { minLength: raw.min_length } : {}),
        ...(typeof raw.max_length === 'number' ? { maxLength: raw.max_length } : {}),
    };
}
function fromSubcommand(raw, index) {
    const key = readString(raw, 'name', `subcommand-${index + 1}`);
    const options = Array.isArray(raw.options) ? raw.options : [];
    return {
        kind: 'subcommand',
        id: `subcommand_${index + 1}_${key}`.slice(0, 48),
        key,
        name: text(raw.name_localizations, key),
        description: text(raw.description_localizations, readString(raw, 'description', key)),
        options: options.map((option, optionIndex) => fromParameter(option, optionIndex)),
    };
}
function fromOption(raw, index) {
    if (Number(raw.type) === OPTION_TYPES.subcommand)
        return fromSubcommand(raw, index);
    if (Number(raw.type) === OPTION_TYPES.subcommand_group) {
        const key = readString(raw, 'name', `group-${index + 1}`);
        const options = Array.isArray(raw.options) ? raw.options : [];
        return {
            kind: 'subcommand_group',
            id: `group_${index + 1}_${key}`.slice(0, 48),
            key,
            name: text(raw.name_localizations, key),
            description: text(raw.description_localizations, readString(raw, 'description', key)),
            options: options.map((option, optionIndex) => fromSubcommand(option, optionIndex)),
        };
    }
    return fromParameter(raw, index);
}
function createNativeFactoryDefinition(payload, requireBotAdmin) {
    const name = readString(payload, 'name');
    const description = readString(payload, 'description', name);
    const options = Array.isArray(payload.options) ? payload.options : [];
    return (0, definition_1.parseCustomCommandDefinition)({
        schemaVersion: 1,
        execution: { mode: 'native', factoryCommandName: name },
        command: {
            name: text(payload.name_localizations, name),
            description: text(payload.description_localizations, description),
            options: options.map((option, index) => fromOption(option, index)),
            defaultMemberPermissions: typeof payload.default_member_permissions === 'string'
                ? payload.default_member_permissions
                : null,
            nsfw: payload.nsfw === true,
        },
        permissions: {
            requireBotAdmin,
            allowedRoleIds: [],
            allowedUserIds: [],
            cooldownSeconds: 0,
        },
        workflow: [],
    });
}
//# sourceMappingURL=compiler.js.map