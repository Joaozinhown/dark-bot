"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const definition_1 = require("./definition");
const compiler_1 = require("./compiler");
(0, node_test_1.default)('compiles bilingual slash command payloads', () => {
    const definition = (0, definition_1.createBlankCommandDefinition)('saudacao');
    definition.command.name.enUS = 'greeting';
    definition.command.description = { ptBR: 'Envia uma saudacao', enUS: 'Sends a greeting' };
    definition.command.options.push({
        kind: 'parameter',
        id: 'target_user',
        key: 'usuario',
        type: 'user',
        name: { ptBR: 'usuario', enUS: 'user' },
        description: { ptBR: 'Usuario alvo', enUS: 'Target user' },
        required: true,
    });
    const payload = (0, compiler_1.compileDiscordCommand)(definition);
    strict_1.default.equal(payload.name, 'saudacao');
    strict_1.default.equal(payload.name_localizations['en-US'], 'greeting');
    strict_1.default.equal(payload.options[0].type, 6);
});
(0, node_test_1.default)('converts native payload into a restorable factory definition', () => {
    const definition = (0, compiler_1.createNativeFactoryDefinition)({
        name: 'ranking',
        description: 'Mostra ranking',
        options: [],
    }, false);
    strict_1.default.equal(definition.execution.mode, 'native');
    strict_1.default.equal(definition.execution.factoryCommandName, 'ranking');
    strict_1.default.equal(definition.command.name.enUS, 'ranking');
});
(0, node_test_1.default)('rejects workflow definitions without executable steps', () => {
    const definition = (0, definition_1.createBlankCommandDefinition)('vazio');
    definition.workflow = [];
    strict_1.default.throws(() => (0, compiler_1.compileDiscordCommand)(definition), /ao menos uma etapa/);
});
//# sourceMappingURL=compiler.test.js.map