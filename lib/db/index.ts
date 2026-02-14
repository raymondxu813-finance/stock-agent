// /lib/db/index.ts

/**
 * Prisma Client 单例
 *
 * Prisma v7 要求使用 driver adapter 连接数据库。
 * 使用 @prisma/adapter-pg + pg 库直连 PostgreSQL。
 *
 * 只有配置了 DATABASE_URL 环境变量时才会初始化。
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

/**
 * 获取 Prisma Client 实例
 * @returns PrismaClient 单例，如果未配置 DATABASE_URL 则返回 null
 */
export function getPrismaClient(): InstanceType<typeof PrismaClient> | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalForPrisma.prisma) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

/**
 * 检查数据库是否可用
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma) return false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { PrismaClient };
