export * from '@prisma/client';
import { PrismaClient } from '@prisma/client';

var globalPrisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!globalPrisma) {
    globalPrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return globalPrisma;
}

export { globalPrisma as prisma };
export * from './errors.js';
export * from './messaging.repository.js';
export * from './conversation-authorization.service.js';
export * from './outbox.repository.js';
export * from './notification.repository.js';
