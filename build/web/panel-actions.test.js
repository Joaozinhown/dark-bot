"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const panel_actions_1 = require("./panel-actions");
const definition_1 = require("../custom-commands/definition");
const ROLE_ID = '123456789012345678';
(0, node_test_1.default)('accepts only the supported administrative action catalog', () => {
    const parsed = panel_actions_1.panelActionSchema.parse({
        type: 'confrontation.create',
        poolId: 2,
        teamARoleId: ROLE_ID,
        teamBRoleId: '223456789012345678',
        channelId: '323456789012345678',
    });
    strict_1.default.equal(parsed.type, 'confrontation.create');
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({ type: 'command.create', name: 'unsafe' }));
});
(0, node_test_1.default)('rejects malformed Discord ids, colors and unbounded text', () => {
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({
        type: 'team.create',
        name: 'Team',
        color: 'purple',
    }));
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({
        type: 'team.member-add',
        roleId: '../role',
        userId: ROLE_ID,
    }));
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({
        type: 'confrontation.close',
        confrontationId: 1,
        reason: 'x'.repeat(501),
    }));
});
(0, node_test_1.default)('accepts static activation and validated dynamic command drafts', () => {
    strict_1.default.deepEqual(panel_actions_1.panelActionSchema.parse({
        type: 'command.set-enabled',
        commandName: 'criar-confronto',
        enabled: false,
    }), {
        type: 'command.set-enabled',
        commandName: 'criar-confronto',
        enabled: false,
    });
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({
        type: 'command.set-enabled',
        commandName: 'Bad Command',
        enabled: true,
    }));
    const definition = (0, definition_1.createBlankCommandDefinition)('hello');
    const draft = panel_actions_1.panelActionSchema.parse({
        type: 'command.save-draft',
        commandId: null,
        sourceType: 'custom',
        factoryCommandName: null,
        definition,
    });
    strict_1.default.equal(draft.type, 'command.save-draft');
    strict_1.default.equal(draft.definition.command.name.enUS, 'hello');
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({
        type: 'command.preview',
        definition: { ...definition, workflow: [] },
    }));
});
(0, node_test_1.default)('validates separate role and user access for scripts', () => {
    const parsed = panel_actions_1.panelActionSchema.parse({
        type: 'permission.set-script-access',
        roleIds: [ROLE_ID],
        userIds: ['223456789012345678'],
    });
    strict_1.default.equal(parsed.type, 'permission.set-script-access');
    strict_1.default.throws(() => panel_actions_1.panelActionSchema.parse({
        type: 'permission.set-script-access',
        roleIds: ['not-a-role'],
        userIds: [],
    }));
});
//# sourceMappingURL=panel-actions.test.js.map