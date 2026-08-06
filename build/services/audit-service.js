"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = void 0;
exports.createAuditService = createAuditService;
const client_1 = __importDefault(require("../database/client"));
function parseDetails(value) {
    try {
        const parsed = JSON.parse(value);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function createAuditService(store) {
    return {
        async write(input) {
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
        async list(guildId, requestedLimit = 50) {
            const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit)));
            const records = await store.listByGuild(guildId, limit);
            return records.map(record => ({ ...record, details: parseDetails(record.details) }));
        },
    };
}
const prismaAuditStore = {
    create: input => client_1.default.auditLog.create({ data: input }),
    listByGuild: (guildId, limit) => client_1.default.auditLog.findMany({
        where: { guildId },
        orderBy: { criadoEm: 'desc' },
        take: limit,
    }),
};
exports.auditService = createAuditService(prismaAuditStore);
//# sourceMappingURL=audit-service.js.map