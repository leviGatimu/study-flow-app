import { PrismaClient } from '../node_modules/.prisma/client-custom-v8';

// Bypassing global cache once to force refresh with new models
export const prisma = new PrismaClient();

// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
