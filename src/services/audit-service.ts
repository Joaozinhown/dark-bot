import prisma from '../database/client';

export interface AuditRecord {
  id: number;
  guildId: string;
  actorUserId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string;
  criadoEm: Date;
}

export interface AuditWriteInput {
  guildId: string;
  actorUserId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Readonly<Record<string, unknown>>;
}

export interface AuditStore {
  create(input: Omit<AuditRecord, 'id' | 'criadoEm'>): Promise<AuditRecord>;
  listByGuild(guildId: string, limit: number): Promise<AuditRecord[]>;
}

export interface AuditEntry extends Omit<AuditRecord, 'details'> {
  details: Readonly<Record<string, unknown>>;
}

function parseDetails(value: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function createAuditService(store: AuditStore) {
  return {
    async write(input: AuditWriteInput): Promise<AuditEntry> {
      const record = await store.create({
        guildId: input.guildId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        details: JSON.stringify(input.details ?? {}),
      });
      return { ...record, details: parseDetails(record.details) };
    },

    async list(guildId: string, requestedLimit = 50): Promise<AuditEntry[]> {
      const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit)));
      const records = await store.listByGuild(guildId, limit);
      return records.map(record => ({ ...record, details: parseDetails(record.details) }));
    },
  };
}

const prismaAuditStore: AuditStore = {
  create: input => prisma.auditLog.create({ data: input }),
  listByGuild: (guildId, limit) => prisma.auditLog.findMany({
    where: { guildId },
    orderBy: { criadoEm: 'desc' },
    take: limit,
  }),
};

export const auditService = createAuditService(prismaAuditStore);
