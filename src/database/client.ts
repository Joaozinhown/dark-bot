import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ??= 'file:./prisma/darkbot.db';

const prisma = new PrismaClient();

export default prisma;
