import type { PoolFormato, VetoVez } from '../types/index';
import { type VetoAction } from '../systems/veto-rules';
export interface VetoActor {
    readonly userId: string;
    readonly username: string;
    readonly displayName: string;
    readonly teamSide: VetoVez;
    readonly teamRoleId: string;
    readonly teamRoleName: string;
}
export interface VetoSelectionInput {
    readonly guildId: string;
    readonly channelId: string;
    readonly confrontationId: number;
    readonly format: PoolFormato;
    readonly stepIndex: number;
    readonly turn: VetoVez;
    readonly messageId: string;
    readonly killersSerialized: string;
    readonly pickedKillersSerialized: string;
    readonly killer: string;
    readonly actor: VetoActor;
}
export interface VetoAuditDetails {
    readonly actorDisplayName: string;
    readonly actorUsername: string;
    readonly channelId: string;
    readonly killer: string;
    readonly messageId: string;
    readonly setNumber: number | null;
    readonly teamRoleId: string;
    readonly teamRoleName: string;
    readonly teamSide: VetoVez;
    readonly vetoStep: number;
}
export interface CommitVetoSelectionInput {
    readonly expected: {
        readonly confrontationId: number;
        readonly stepIndex: number;
        readonly turn: VetoVez;
        readonly messageId: string;
        readonly killersSerialized: string;
        readonly pickedKillersSerialized: string;
    };
    readonly next: {
        readonly stepIndex: number;
        readonly turn: VetoVez;
        readonly killersSerialized: string;
        readonly pickedKillersSerialized: string;
        readonly messageId: null;
    };
    readonly audit: {
        readonly guildId: string;
        readonly actorUserId: string;
        readonly action: `veto.${VetoAction}`;
        readonly entityType: 'confrontation';
        readonly entityId: string;
        readonly details: VetoAuditDetails;
    };
}
export interface VetoSelectionStore {
    commit(input: CommitVetoSelectionInput): Promise<boolean>;
}
export interface VetoSelectionResult {
    readonly action: VetoAction;
    readonly isTiebreak: boolean;
    readonly setNumber: number | null;
    readonly selectedKiller: string;
    readonly remainingKillers: readonly string[];
    readonly pickedKillers: readonly string[];
    readonly nextTurn: VetoVez;
}
export type VetoSelectionServiceErrorCode = 'INVALID_STATE' | 'KILLER_UNAVAILABLE' | 'WRONG_TEAM' | 'STALE_STATE';
export declare class VetoSelectionServiceError extends Error {
    readonly code: VetoSelectionServiceErrorCode;
    constructor(code: VetoSelectionServiceErrorCode, message: string);
}
export declare const prismaVetoSelectionStore: VetoSelectionStore;
export declare function createVetoSelectionService(store?: VetoSelectionStore): {
    select: (input: VetoSelectionInput) => Promise<VetoSelectionResult>;
};
export declare const vetoSelectionService: {
    select: (input: VetoSelectionInput) => Promise<VetoSelectionResult>;
};
//# sourceMappingURL=veto-selection-service.d.ts.map