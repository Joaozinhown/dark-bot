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
export declare function createAuditService(store: AuditStore): {
    write(input: AuditWriteInput): Promise<AuditEntry>;
    list(guildId: string, requestedLimit?: number): Promise<AuditEntry[]>;
};
export declare const auditService: {
    write(input: AuditWriteInput): Promise<AuditEntry>;
    list(guildId: string, requestedLimit?: number): Promise<AuditEntry[]>;
};
//# sourceMappingURL=audit-service.d.ts.map