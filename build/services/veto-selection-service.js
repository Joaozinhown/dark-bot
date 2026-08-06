"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vetoSelectionService = exports.prismaVetoSelectionStore = exports.VetoSelectionServiceError = void 0;
exports.createVetoSelectionService = createVetoSelectionService;
const client_1 = __importDefault(require("../database/client"));
const veto_rules_1 = require("../systems/veto-rules");
class VetoSelectionServiceError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'VetoSelectionServiceError';
    }
}
exports.VetoSelectionServiceError = VetoSelectionServiceError;
function parseStringArray(value) {
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
            throw new Error('Expected a string array.');
        }
        return [...parsed];
    }
    catch {
        throw new VetoSelectionServiceError('INVALID_STATE', 'O estado do veto esta corrompido.');
    }
}
exports.prismaVetoSelectionStore = {
    async commit(input) {
        return client_1.default.$transaction(async (transaction) => {
            const updated = await transaction.vetoState.updateMany({
                where: {
                    confrontoId: input.expected.confrontationId,
                    set: input.expected.stepIndex,
                    vezDe: input.expected.turn,
                    messageId: input.expected.messageId,
                    killersRestantes: input.expected.killersSerialized,
                    killerEscolhido: input.expected.pickedKillersSerialized,
                },
                data: {
                    set: input.next.stepIndex,
                    vezDe: input.next.turn,
                    killersRestantes: input.next.killersSerialized,
                    killerEscolhido: input.next.pickedKillersSerialized,
                    messageId: input.next.messageId,
                },
            });
            if (updated.count !== 1)
                return false;
            await transaction.auditLog.create({
                data: {
                    guildId: input.audit.guildId,
                    actorUserId: input.audit.actorUserId,
                    action: input.audit.action,
                    entityType: input.audit.entityType,
                    entityId: input.audit.entityId,
                    details: JSON.stringify(input.audit.details),
                },
            });
            return true;
        });
    },
};
function createVetoSelectionService(store = exports.prismaVetoSelectionStore) {
    async function select(input) {
        if (input.actor.teamSide !== input.turn) {
            throw new VetoSelectionServiceError('WRONG_TEAM', 'Nao e a vez do seu time.');
        }
        const killers = parseStringArray(input.killersSerialized);
        const pickedKillers = parseStringArray(input.pickedKillersSerialized);
        const killerIndex = killers.indexOf(input.killer);
        if (killerIndex < 0 || killers.length <= 1) {
            throw new VetoSelectionServiceError('KILLER_UNAVAILABLE', 'Killer indisponivel. Use a mensagem mais recente.');
        }
        const { action, isTiebreak } = (0, veto_rules_1.getVetoAction)(input.format, input.stepIndex);
        const setNumber = (0, veto_rules_1.getPickSetNumber)(action, pickedKillers.length);
        const remainingKillers = killers.filter((_, index) => index !== killerIndex);
        const nextPickedKillers = action === 'pick'
            ? [...pickedKillers, input.killer]
            : pickedKillers;
        const nextTurn = input.turn === 'A' ? 'B' : 'A';
        const committed = await store.commit({
            expected: {
                confrontationId: input.confrontationId,
                stepIndex: input.stepIndex,
                turn: input.turn,
                messageId: input.messageId,
                killersSerialized: input.killersSerialized,
                pickedKillersSerialized: input.pickedKillersSerialized,
            },
            next: {
                stepIndex: input.stepIndex + 1,
                turn: nextTurn,
                killersSerialized: JSON.stringify(remainingKillers),
                pickedKillersSerialized: JSON.stringify(nextPickedKillers),
                messageId: null,
            },
            audit: {
                guildId: input.guildId,
                actorUserId: input.actor.userId,
                action: `veto.${action}`,
                entityType: 'confrontation',
                entityId: String(input.confrontationId),
                details: {
                    actorDisplayName: input.actor.displayName,
                    actorUsername: input.actor.username,
                    channelId: input.channelId,
                    killer: input.killer,
                    messageId: input.messageId,
                    setNumber,
                    teamRoleId: input.actor.teamRoleId,
                    teamRoleName: input.actor.teamRoleName,
                    teamSide: input.actor.teamSide,
                    vetoStep: input.stepIndex + 1,
                },
            },
        });
        if (!committed) {
            throw new VetoSelectionServiceError('STALE_STATE', 'Esta etapa ja foi respondida. Use a mensagem mais recente.');
        }
        return {
            action,
            isTiebreak,
            setNumber,
            selectedKiller: input.killer,
            remainingKillers,
            pickedKillers: nextPickedKillers,
            nextTurn,
        };
    }
    return { select };
}
exports.vetoSelectionService = createVetoSelectionService();
//# sourceMappingURL=veto-selection-service.js.map