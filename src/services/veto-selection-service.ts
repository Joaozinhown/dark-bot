import prisma from '../database/client';
import type { PoolFormato, VetoVez } from '../types/index';
import {
  getPickSetNumber,
  getVetoAction,
  type VetoAction,
} from '../systems/veto-rules';

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

export type VetoSelectionServiceErrorCode =
  | 'INVALID_STATE'
  | 'KILLER_UNAVAILABLE'
  | 'WRONG_TEAM'
  | 'STALE_STATE';

export class VetoSelectionServiceError extends Error {
  constructor(
    readonly code: VetoSelectionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VetoSelectionServiceError';
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
      throw new Error('Expected a string array.');
    }
    return [...parsed];
  } catch {
    throw new VetoSelectionServiceError('INVALID_STATE', 'O estado do veto esta corrompido.');
  }
}

export const prismaVetoSelectionStore: VetoSelectionStore = {
  async commit(input) {
    return prisma.$transaction(async transaction => {
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
      if (updated.count !== 1) return false;

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

export function createVetoSelectionService(
  store: VetoSelectionStore = prismaVetoSelectionStore,
) {
  async function select(input: VetoSelectionInput): Promise<VetoSelectionResult> {
    if (input.actor.teamSide !== input.turn) {
      throw new VetoSelectionServiceError('WRONG_TEAM', 'Nao e a vez do seu time.');
    }

    const killers = parseStringArray(input.killersSerialized);
    const pickedKillers = parseStringArray(input.pickedKillersSerialized);
    const killerIndex = killers.indexOf(input.killer);
    if (killerIndex < 0 || killers.length <= 1) {
      throw new VetoSelectionServiceError(
        'KILLER_UNAVAILABLE',
        'Killer indisponivel. Use a mensagem mais recente.',
      );
    }

    const { action, isTiebreak } = getVetoAction(input.format, input.stepIndex);
    const setNumber = getPickSetNumber(action, pickedKillers.length);
    const remainingKillers = killers.filter((_, index) => index !== killerIndex);
    const nextPickedKillers = action === 'pick'
      ? [...pickedKillers, input.killer]
      : pickedKillers;
    const nextTurn: VetoVez = input.turn === 'A' ? 'B' : 'A';

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
      throw new VetoSelectionServiceError(
        'STALE_STATE',
        'Esta etapa ja foi respondida. Use a mensagem mais recente.',
      );
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

export const vetoSelectionService = createVetoSelectionService();
