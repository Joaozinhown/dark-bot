"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customInteractionState = void 0;
exports.interactionCustomId = interactionCustomId;
exports.readInteractionToken = readInteractionToken;
const node_crypto_1 = require("node:crypto");
const client_1 = __importDefault(require("../database/client"));
const definition_1 = require("./definition");
const CUSTOM_ID_PREFIX = 'dta-cmd:';
function parseContext(value) {
    try {
        const parsed = JSON.parse(value);
        return {
            userId: typeof parsed.userId === 'string' ? parsed.userId : '',
            variables: parsed.variables && typeof parsed.variables === 'object' ? parsed.variables : {},
            options: parsed.options && typeof parsed.options === 'object' ? parsed.options : {},
        };
    }
    catch {
        return { userId: '', variables: {}, options: {} };
    }
}
function interactionCustomId(token) {
    return `${CUSTOM_ID_PREFIX}${token}`;
}
function readInteractionToken(customId) {
    return customId.startsWith(CUSTOM_ID_PREFIX)
        ? customId.slice(CUSTOM_ID_PREFIX.length)
        : null;
}
exports.customInteractionState = {
    async create(input) {
        const token = (0, node_crypto_1.randomBytes)(18).toString('base64url');
        await client_1.default.customCommandInteraction.create({
            data: {
                token,
                guildId: input.guildId,
                commandId: input.commandId,
                commandVersionId: input.commandVersionId,
                nodeId: input.nodeId,
                contextJson: JSON.stringify(input.context),
                allowedUserId: input.allowedUserId,
                expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
            },
        });
        void client_1.default.customCommandInteraction.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        }).catch(() => undefined);
        return token;
    },
    async resolve(guildId, token) {
        const state = await client_1.default.customCommandInteraction.findFirst({
            where: { token, guildId, expiresAt: { gt: new Date() } },
            include: { commandVersion: true },
        });
        if (!state)
            return null;
        return {
            token: state.token,
            commandId: state.commandId,
            commandVersionId: state.commandVersionId,
            nodeId: state.nodeId,
            allowedUserId: state.allowedUserId,
            definition: (0, definition_1.parseCustomCommandDefinition)(JSON.parse(state.commandVersion.definition)),
            context: parseContext(state.contextJson),
        };
    },
};
//# sourceMappingURL=interaction-state.js.map