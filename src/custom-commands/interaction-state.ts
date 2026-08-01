import { randomBytes } from 'node:crypto';
import prisma from '../database/client';
import { parseCustomCommandDefinition, type CustomCommandDefinition } from './definition';

const CUSTOM_ID_PREFIX = 'dta-cmd:';

export interface InteractionContextSnapshot {
  readonly userId: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface ResolvedInteractionState {
  readonly token: string;
  readonly commandId: number;
  readonly commandVersionId: number;
  readonly nodeId: string;
  readonly allowedUserId: string | null;
  readonly definition: CustomCommandDefinition;
  readonly context: InteractionContextSnapshot;
}

function parseContext(value: string): InteractionContextSnapshot {
  try {
    const parsed = JSON.parse(value) as Partial<InteractionContextSnapshot>;
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      variables: parsed.variables && typeof parsed.variables === 'object' ? parsed.variables : {},
      options: parsed.options && typeof parsed.options === 'object' ? parsed.options : {},
    };
  } catch {
    return { userId: '', variables: {}, options: {} };
  }
}

export function interactionCustomId(token: string): string {
  return `${CUSTOM_ID_PREFIX}${token}`;
}

export function readInteractionToken(customId: string): string | null {
  return customId.startsWith(CUSTOM_ID_PREFIX)
    ? customId.slice(CUSTOM_ID_PREFIX.length)
    : null;
}

export const customInteractionState = {
  async create(input: {
    guildId: string;
    commandId: number;
    commandVersionId: number;
    nodeId: string;
    context: InteractionContextSnapshot;
    allowedUserId: string | null;
    expiresInSeconds: number;
  }): Promise<string> {
    const token = randomBytes(18).toString('base64url');
    await prisma.customCommandInteraction.create({
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
    void prisma.customCommandInteraction.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }).catch(() => undefined);
    return token;
  },

  async resolve(guildId: string, token: string): Promise<ResolvedInteractionState | null> {
    const state = await prisma.customCommandInteraction.findFirst({
      where: { token, guildId, expiresAt: { gt: new Date() } },
      include: { commandVersion: true },
    });
    if (!state) return null;
    return {
      token: state.token,
      commandId: state.commandId,
      commandVersionId: state.commandVersionId,
      nodeId: state.nodeId,
      allowedUserId: state.allowedUserId,
      definition: parseCustomCommandDefinition(JSON.parse(state.commandVersion.definition)),
      context: parseContext(state.contextJson),
    };
  },
};
