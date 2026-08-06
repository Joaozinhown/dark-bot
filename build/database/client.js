"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
process.env.DATABASE_URL ??= 'file:./prisma/darkbot.db';
const prisma = new client_1.PrismaClient();
exports.default = prisma;
//# sourceMappingURL=client.js.map